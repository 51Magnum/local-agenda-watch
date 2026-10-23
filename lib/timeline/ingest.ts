import { createHash } from "node:crypto";
import { DECISION_KEYS, type EvidenceField, type IngestionRun, type PageText, type SourceDocument } from "./types";
import type { EvidenceStore } from "./store";
import { extractFields, extractNativePdfPages, ocrMissingPages, validateExtraction, EXTRACTION_VERSION, type Extraction } from "./extract";

export const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export function officialDocumentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["nampa.primegov.com", "www.cityofnampa.us", "id-nampa2.civicplus.com", "nampaid-energovpub.tylerhost.net"].includes(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
export async function downloadDocument(url: string): Promise<Uint8Array> {
  if (!officialDocumentUrl(url)) throw new Error("Document is outside the official source allowlist");
  // Do not follow a city redirect to an unvalidated host.
  let target = url;
  for (let i = 0; i < 4; i++) {
    const response = await fetch(target, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { Accept: "application/pdf", "User-Agent": "Mozilla/5.0 LocalAgendaWatch/1.0" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Document redirect missing location");
      target = new URL(location, target).href;
      const redirected = new URL(target);
      const officialStorage = redirected.protocol === "https:" && redirected.hostname === "pgwest.blob.core.windows.net" && redirected.pathname.startsWith("/nampa/") && !redirected.username && !redirected.password;
      if (!officialDocumentUrl(target) && !officialStorage) throw new Error("Document redirect is outside the official source allowlist");
      continue;
    }
    if (!response.ok) throw new Error("Document HTTP " + response.status);
    if (Number(response.headers.get("content-length")) > 45000000) throw new Error("Document exceeds 45 MB limit");
    const reader = response.body?.getReader(); if (!reader) throw new Error("Empty document response");
    const chunks: Uint8Array[] = []; let length = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 45000000) { await reader.cancel(); throw new Error("Document exceeds 45 MB limit"); } chunks.push(value); }
    const bytes = new Uint8Array(Buffer.concat(chunks));
    if (!Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from("%PDF-"))) throw new Error("Expected PDF; received HTML, challenge, or unsupported file");
    return bytes;
  }
  throw new Error("Too many document redirects");
}
export type IngestDependencies = {
  download?: typeof downloadDocument;
  text?: (bytes: Uint8Array) => Promise<PageText[]>;
  ocr?: typeof ocrMissingPages;
  extract?: (document: SourceDocument, caseId: string, pages: PageText[]) => Promise<Extraction>;
  budgetMs?: number;
};
export async function ingestDocuments(store: EvidenceStore, documents: SourceDocument[], dependencies: IngestDependencies = {}): Promise<IngestionRun> {
  const run: IngestionRun = { startedAt: new Date().toISOString(), checked: 0, processed: 0, skipped: 0, errors: [] };
  const deadline = Date.now() + (dependencies.budgetMs ?? 190000);
  const unique = [...new Map(documents.map((d) => [d.url, d])).values()];
  for (const document of unique) {
    if (Date.now() > deadline) { run.errors.push("Processing budget reached; remaining documents will be retried on the next run."); break; }
    const id = digest(document.url); run.checked++;
    let replaced = false;
    try {
      if (!officialDocumentUrl(document.url)) throw new Error("Invalid official source URL");
      const bytes = document.content === undefined ? await (dependencies.download ?? downloadDocument)(document.url) : new TextEncoder().encode(document.content);
      const hash = digest(bytes);
      const before = (await store.read()).documents[id];
      const same = before?.hash === hash && before.extractionVersion === EXTRACTION_VERSION;
      if (same && before.state === "complete" && document.caseIds.every((caseId) => before.caseIds.includes(caseId))) {
        await store.mutate((state) => { if (state.documents[id]?.hash === hash) state.documents[id].checkedAt = new Date().toISOString(); });
        run.skipped++; continue;
      }
      // Invalidate previous evidence before extracting changed bytes, even if extraction later fails.
      await store.mutate((state) => { state.documents[id] = { ...document, id, hash, pages: same ? before.pages : [], checkedAt: new Date().toISOString(), extractionVersion: EXTRACTION_VERSION, processedCaseIds: same ? before.processedCaseIds ?? [] : [], state: "processing" }; });
      replaced = true;
      let pages: PageText[] = document.content !== undefined
        ? [{ page: 1, text: document.content, method: "structured" }]
        : same && before.pages.length ? before.pages : await (dependencies.text ?? extractNativePdfPages)(bytes);
      await store.mutate((state) => { if (state.documents[id]?.hash === hash) state.documents[id].pages = pages; });
      if (document.content === undefined) {
        if (pages.some((page) => page.method === "native" && page.text.trim().length < 30) && deadline - Date.now() < 50000) throw new Error("OCR deferred to next run: processing budget reached");
        pages = await (dependencies.ocr ?? ocrMissingPages)(bytes, pages);
        await store.mutate((state) => { if (state.documents[id]?.hash === hash) state.documents[id].pages = pages; });
      }
      const facts: EvidenceField[] = [];
      const now = new Date().toISOString();
      for (const caseId of document.caseIds) {
        if (same && before.processedCaseIds?.includes(caseId)) continue;
        if (document.fields) {
          for (const field of document.fields) {
            if (DECISION_KEYS.has(field.key)) throw new Error("Decision fields must pass through document extraction and manual review");
            facts.push({ ...field, caseId, id: digest(id + hash + caseId + field.key + field.value), documentId: id, documentHash: hash, sourceUrl: document.url, sourceKind: document.kind, confidence: 1, status: "auto_published", createdAt: now });
          }
        } else if (document.kind !== "agenda" && document.kind !== "case-record") {
          if (deadline - Date.now() < 50000) throw new Error("Case extraction deferred to next run: processing budget reached");
          const warnings: string[] = [];
          const extracted = validateExtraction(await (dependencies.extract ?? extractFields)(document, caseId, pages), pages, { warnings });
          if (warnings.length) {
            console.warn("[timeline:ingest] Omitted unsupported fields for " + caseId, warnings);
            await store.mutate((state) => {
              if (state.documents[id]?.hash === hash) state.documents[id].validationWarnings = [...(state.documents[id].validationWarnings ?? []), ...warnings.map((warning) => caseId + ": " + warning)];
            });
          }
          for (const [key, value] of Object.entries(extracted)) {
            if (value.value === null || value.page === null || !value.quote) continue;
            const fieldKey = key as EvidenceField["key"];
            if (fieldKey === "decisionDate" && document.kind === "pz-decision") continue;
            if (DECISION_KEYS.has(fieldKey) && !["pz-decision", "council-decision", "findings", "minutes"].includes(document.kind)) continue;
            const ocr = pages.find((p) => p.page === value.page)?.method === "ocr";
            facts.push({ id: digest(id + hash + caseId + key + value.value + value.page), documentId: id, documentHash: hash, caseId, key: fieldKey, value: value.value, page: document.content === undefined ? value.page : null, quote: value.quote,
              sourceUrl: document.url, sourceKind: document.kind, confidence: value.confidence,
              status: !DECISION_KEYS.has(fieldKey) && !ocr && value.confidence >= 0.95 ? "auto_published" : "pending", createdAt: now });
          }
        }
        await store.mutate((state) => {
          if (state.documents[id]?.hash !== hash) throw new Error("Document changed during extraction");
          for (const field of facts.filter((f) => f.caseId === caseId)) state.fields[field.id] ??= field;
          state.documents[id].processedCaseIds = [...new Set([...(state.documents[id].processedCaseIds ?? []), caseId])];
        });
      }
      await store.mutate((state) => {
        if (state.documents[id]?.hash !== hash) throw new Error("Document changed during extraction");
        for (const field of facts) state.fields[field.id] ??= field;
        state.documents[id].state = "complete"; state.documents[id].extractedAt = now; delete state.documents[id].error;
      });
      run.processed++;
    } catch (error) {
      const message = document.title + ": " + (error instanceof Error ? error.message : "Processing failed"); run.errors.push(message);
      console.error("[timeline:ingest]", message);
      await store.mutate((state) => { if (state.documents[id]) { if (replaced) state.documents[id].state = "error"; state.documents[id].error = message; } });
    }
  }
  run.finishedAt = new Date().toISOString();
  await store.mutate((state) => { state.runs = [...state.runs.slice(-49), run]; });
  return run;
}
