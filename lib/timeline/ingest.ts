import { allowedSource, sourceRequest, isBlockedSource } from "./source-access";
import { checkpointRun, recordHost, withDocument, withRun } from "./telemetry";
import { parseEnerGovDocumentReference, downloadEnerGovReference } from "@/lib/sources/energov-document";
import { explicitReportFacts } from "./report-facts";
import { createHash } from "node:crypto";
import { DECISION_KEYS, type EvidenceField, type IngestionRun, type PageText, type SourceDocument } from "./types";
import type { EvidenceStore } from "./store";
import { extractFields, extractNativePdfPages, ocrMissingPages, validateExtraction, EXTRACTION_VERSION, type Extraction } from "./extract";

export const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const officialDocumentUrl = allowedSource;
export async function downloadDocument(url: string, areaId = "nampa"): Promise<Uint8Array> {
  if (!officialDocumentUrl(url, areaId)) throw new Error("Document is outside the official source allowlist");
  const energov = parseEnerGovDocumentReference(url);
  if (energov) {try{const bytes=await downloadEnerGovReference(energov);recordHost(areaId,url,"worked");return bytes;}catch(error){recordHost(areaId,url,isBlockedSource(error)?"blocked":"unavailable");throw error;}}
  const response = await sourceRequest(url,areaId,"application/pdf",15000);
  if (Number(response.headers.get("content-length")) > 45000000) throw new Error("Document exceeds 45 MB limit");
  const reader=response.body?.getReader();if(!reader)throw new Error("Empty document response");
  const chunks:Uint8Array[]=[];let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>45000000){await reader.cancel();throw new Error("Document exceeds 45 MB limit");}chunks.push(value);}
  const bytes=new Uint8Array(Buffer.concat(chunks));
  if(!Buffer.from(bytes.subarray(0,1024)).includes(Buffer.from("%PDF-")))throw new Error("Expected PDF; received HTML or unsupported file");
  return bytes;
}
export const documentId = (document:Pick<SourceDocument,"areaId"|"url">) => digest((document.areaId && document.areaId!=="nampa" ? document.areaId+":" : "")+document.url);
export const retryDue = (document:{failCount?:number;lastAttemptAt?:string;state:string},now=Date.now()) => document.state!=="failed-permanent" && (!document.failCount || !document.lastAttemptAt || now-Date.parse(document.lastAttemptAt)>=86400000);
export type IngestDependencies = {
  download?: typeof downloadDocument;
  text?: (bytes: Uint8Array) => Promise<PageText[]>;
  ocr?: typeof ocrMissingPages;
  extract?: (document: SourceDocument, caseId: string, pages: PageText[]) => Promise<Extraction>;
  budgetMs?: number;
  onChecked?: (document:SourceDocument)=>void;
  run?: IngestionRun;
  /** Separate checkpoint for native-only previews; never suppresses full extraction. */
  extractionVersion?: string;
};
async function ingestDocumentsInRun(store: EvidenceStore, documents: SourceDocument[], dependencies: IngestDependencies = {}): Promise<IngestionRun> {
  const run: IngestionRun = dependencies.run!;
  const deadline = Date.now() + (dependencies.budgetMs ?? 190000);
  const extractionVersion = dependencies.extractionVersion ?? EXTRACTION_VERSION;
  const unique = [...new Map(documents.map((d) => [documentId(d), d])).values()];
  for (const document of unique) {
    if (Date.now() > deadline) { run.errors.push("Processing budget reached; remaining documents will be retried on the next run."); break; }
    const id = documentId(document); run.checked++;
    const areaId = document.areaId ?? "nampa";
    let replaced = false;
    await withDocument(areaId,id,async()=>{
    try {
      const stored=(await store.read()).documents[id];
      if(stored&&!stored.hash&&stored.state!=="failed-permanent"&&!retryDue(stored)){run.skipped++;return;}
      if (!officialDocumentUrl(document.url,areaId)) throw new Error("Invalid official source URL");
      if(document.content===undefined&&stored?.structured&&store.pages){const cached=await store.pages(id);document.content=cached[0]?.text;}
      const bytes = document.content === undefined ? await (dependencies.download ?? downloadDocument)(document.url,areaId) : new TextEncoder().encode(document.content);
      const hash = digest(bytes);
      dependencies.onChecked?.(document);
      const before = (await store.read()).documents[id];
      const same = before?.hash === hash && before.extractionVersion === extractionVersion;
      if(before?.hash===hash&&!retryDue(before)){run.skipped++;return;}
      const failCount=before?.hash===hash?before.failCount??0:0;
      if (same && before.state === "complete" && document.caseIds.every((caseId) => before.caseIds.includes(caseId))) {
        run.skipped++; return;
      }
      if(before?.hash===hash&&store.pages&&!before.pages.length)before.pages=await store.pages(id);
      // Invalidate previous evidence before extracting changed bytes, even if extraction later fails.
      await store.mutate((state) => { state.documents[id] = { ...document, id, hash, failCount, lastAttemptAt:new Date().toISOString(), pages: before?.hash === hash ? before.pages : [], checkedAt: new Date().toISOString(), extractionVersion, processedCaseIds: same ? before.processedCaseIds ?? [] : [], state: "processing" }; });
      replaced = true;
      let pages: PageText[] = document.content !== undefined
        ? [{ page: 1, text: document.content, method: "structured" }]
        : before?.hash === hash && before.pages.length ? before.pages : await (dependencies.text ?? extractNativePdfPages)(bytes);
      await store.mutate((state) => { if (state.documents[id]?.hash === hash) state.documents[id].pages = pages; });
      if (document.content === undefined) {
        if (pages.some((page) => page.method === "native" && page.text.trim().length < 30) && deadline - Date.now() < 50000) throw new Error("OCR deferred to next run: processing budget reached");
        pages = await (dependencies.ocr ?? ocrMissingPages)(bytes, pages);
        await store.mutate((state) => { if (state.documents[id]?.hash === hash) state.documents[id].pages = pages; });
      }
      if(document.content===undefined&&pages.some(p=>p.method==="ocr"))await store.flush?.();
      const facts: EvidenceField[] = [];
      const now = new Date().toISOString();
      for (const caseId of document.caseIds) {
        if (same && before.processedCaseIds?.includes(caseId)) continue;
        if (document.fields) {
          for (const field of document.fields) {
            if (DECISION_KEYS.has(field.key)) throw new Error("Decision fields must pass through document extraction and manual review");
            facts.push({ ...field, areaId, caseId, id: digest(id + hash + caseId + field.key + field.value), documentId: id, documentHash: hash, sourceUrl: document.url, sourceKind: document.kind, confidence: 1, status: "auto_published", createdAt: now });
          }
        } else if (document.kind !== "agenda" && document.kind !== "case-record") {
          if (deadline - Date.now() < 50000) throw new Error("Case extraction deferred to next run: processing budget reached");
          const warnings: string[] = [];
          const candidates = await (dependencies.extract ?? extractFields)(document, caseId, pages);
          const extracted = validateExtraction(candidates, pages, { warnings });
          const explicit = validateExtraction(explicitReportFacts(document, caseId, pages), pages);
          for (const key of Object.keys(explicit) as (keyof Extraction)[]) {
            if (explicit[key].value !== null && extracted[key].value === null) {
              extracted[key] = explicit[key];
              for (let i = warnings.length - 1; i >= 0; i--) if (warnings[i].endsWith(" for " + key)) warnings.splice(i, 1);
            }
          }
          if (warnings.length) {
            console.warn("[timeline:ingest] Omitted unsupported fields for " + caseId, warnings);
            await store.mutate((state) => {
              if (state.documents[id]?.hash === hash) state.documents[id].validationWarnings = [...(state.documents[id].validationWarnings ?? []), ...warnings.map((warning) => caseId + ": " + warning)];
            });
          }
          for (const [key, value] of Object.entries(extracted)) {
            if (value.value === null || value.page === null || !value.quote) continue;
            const fieldKey = key as EvidenceField["key"];
            if (["pzSpeakersFor", "pzSpeakersAgainst"].includes(fieldKey) && document.kind !== "minutes") continue;
            if (fieldKey === "pzConditions" && !["pz-decision", "minutes"].includes(document.kind)) continue;
            if (fieldKey === "decisionDate" && document.kind === "pz-decision") continue;
            if (DECISION_KEYS.has(fieldKey) && !["pz-decision", "council-decision", "findings", "minutes"].includes(document.kind)) continue;
            const ocr = pages.find((p) => p.page === value.page)?.method === "ocr";
            facts.push({ areaId, id: digest(id + hash + caseId + key + value.value + value.page), documentId: id, documentHash: hash, caseId, key: fieldKey, value: value.value, page: document.content === undefined ? value.page : null, quote: value.quote,
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
        state.documents[id].failCount=0; state.documents[id].state = "complete"; state.documents[id].extractedAt = now; delete state.documents[id].error;
      });
      run.processed++;
      if(run.areas?.[areaId]){run.areas[areaId].processed=(run.areas[areaId].processed??0)+1;if(!document.fields&&!["case-record","agenda"].includes(document.kind))run.areas[areaId].extracted++;}
    } catch (error) {
      const message = document.title + ": " + (error instanceof Error ? error.message : "Processing failed"); run.errors.push(message);
      console.error("[timeline:ingest]", message);
      if(isBlockedSource(error)){recordHost(areaId,document.url,"blocked","Access challenge; no retry consumed");run.skipped++;return;}
      const deferred=/deferred to next run|processing budget reached/i.test(message);
      await store.mutate((state) => {
        const current=state.documents[id];
        if(deferred){if(current)current.error=message;return;}
        // Failed downloads never invalidate a previously published document version.
        if(!current)state.documents[id]={...document,id,hash:"",pages:[],checkedAt:new Date().toISOString(),state:"error"};
        const doc=state.documents[id];
        doc.failCount=Math.min(3,(doc.failCount??0)+1);doc.lastAttemptAt=new Date().toISOString();doc.error=message;
        if(doc.failCount>=3)doc.state="failed-permanent";else if(replaced||doc.state!=="complete")doc.state="error";
      });
    }
    });
    if(run.checked%25===0){await checkpointRun(store,run);await store.flush?.();}
  }
  run.finishedAt = new Date().toISOString();
  await checkpointRun(store,run);
  return run;
}

export async function ingestDocuments(store:EvidenceStore,documents:SourceDocument[],dependencies:IngestDependencies={}):Promise<IngestionRun>{
 const run=dependencies.run??{startedAt:new Date().toISOString(),checked:0,processed:0,skipped:0,errors:[]};
 if(dependencies.run)return ingestDocumentsInRun(store,documents,{...dependencies,run});
 return withRun(store,run,()=>ingestDocumentsInRun(store,documents,{...dependencies,run}));
}
