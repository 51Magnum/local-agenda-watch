import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ingestDocuments, digest, officialDocumentUrl } from "./ingest";
import { emptyEvidenceState, EXTRACTED_KEYS, publicFields, type SourceDocument } from "./types";
import { reviewField } from "./review";
import { validateExtraction, type Extraction } from "./extract";
import { buildTimeline } from "./public";
import { acquireLease, createFileStore, releaseLease, type EvidenceStore } from "./store";
import { authorizedReviewer, secretMatches } from "./auth";
import { CaseTimeline } from "@/app/components/case-timeline";
import { stageNavigationLinks } from "@/lib/stage-navigation";
import { braeburnCreek } from "@/lib/projects";

// Synthetic decision-letter fixture; this is NOT seeded into public or production data.
const caseIds = ["ANN-00371-2026", "SPP-00184-2026"];
const document: SourceDocument = { url: "https://www.cityofnampa.us/DocumentCenter/View/123/fixture.pdf", title: "PZ decision letter (test fixture)", caseIds, kind: "pz-decision" };
const quote = "On September 29, 2026, P&Z recommended approval by a vote of 6-0.";
const pages = [{ page: 1, text: quote, method: "native" as const }];
const extraction = (over: Partial<Extraction> = {}): Extraction => ({ ...Object.fromEntries(EXTRACTED_KEYS.map((key) => [key, { value: null, page: null, quote: null, confidence: 0 }])), ...over } as Extraction);
const decision = () => extraction({ pzHearingDate: { value: "2026-09-29", page: 1, quote, confidence: 0.99 }, pzResult: { value: "recommend approval", page: 1, quote, confidence: 1 }, pzVote: { value: "6-0", page: 1, quote, confidence: 1 } });
function memoryStore(): EvidenceStore {
  const state = emptyEvidenceState();
  return { read: async () => structuredClone(state), mutate: async (fn) => fn(state) };
}
const dependencies = () => ({ download: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])), text: vi.fn().mockResolvedValue(pages), extract: vi.fn().mockResolvedValue(decision()) });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("hash-based ingestion and review", () => {
  it("extracts shared report text once and makes no new AI calls for unchanged documents", async () => {
    const store = memoryStore(), deps = dependencies();
    expect((await ingestDocuments(store, [document, document], deps)).processed).toBe(1);
    expect(deps.text).toHaveBeenCalledTimes(1);
    expect(deps.extract).toHaveBeenCalledTimes(2);
    expect((await ingestDocuments(store, [document], deps)).skipped).toBe(1);
    expect(deps.extract).toHaveBeenCalledTimes(2);
    expect(deps.text).toHaveBeenCalledTimes(1);
  });
  it("keeps even 100%-confidence decisions and votes pending until approved", async () => {
    const store = memoryStore(); await ingestDocuments(store, [document], dependencies());
    const state = await store.read();
    expect(Object.values(state.fields).filter((field) => ["pzResult", "pzVote"].includes(field.key)).every((field) => field.status === "pending")).toBe(true);
    expect(publicFields(state, caseIds).map((field) => field.key)).toEqual(["pzHearingDate", "pzHearingDate"]);
  });
  it("renders Braeburn's applied date, approved P&Z result with page citation, and upcoming Council date", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T18:00:00Z"));
    const store = memoryStore();
    await ingestDocuments(store, [document], dependencies());
    const record: SourceDocument = { url: "https://nampaid-energovpub.tylerhost.net/Apps/SelfService#/plan/fixture", title: "Case record fixture", caseIds, kind: "case-record", content: "ApplyDate: 2026-08-01", fields: [{ key: "appliedDate", value: "2026-08-01", quote: "ApplyDate: 2026-08-01", page: null }] };
    await ingestDocuments(store, [record]);
    const props = { caseIds, stage: "Council hearing" as const, next: braeburnCreek.nextHearing };
    const before = renderToStaticMarkup(createElement(CaseTimeline, { data: buildTimeline(await store.read(), props), links: stageNavigationLinks("/case", "/meetings?case=fixture") }));
    expect(before).toContain("Applied Aug 1, 2026");
    expect(before).toContain("Met Sep 29, 2026, result pending minutes or decision letter.");
    expect(before).not.toContain("P&amp;Z recommended approval");
    const pending = Object.values((await store.read()).fields).filter((field) => field.key === "pzResult");
    for (const field of pending) await reviewField(store, { id: field.id, action: "approve" });
    const html = renderToStaticMarkup(createElement(CaseTimeline, { data: buildTimeline(await store.read(), props), links: stageNavigationLinks("/case", "/meetings?case=fixture") }));
    expect(html).toContain("P&amp;Z recommended approval");
    expect(html).toContain("Sep 29, 2026");
    expect(html).toContain("Upcoming: Nov 2, 2026");
    expect(html).toContain("fixture.pdf#page=1");
    expect(html).not.toContain("Vote: 6-0");
  });
  it("invalidates old approvals when source bytes change", async () => {
    const store = memoryStore(), deps = dependencies(); await ingestDocuments(store, [document], deps);
    const field = Object.values((await store.read()).fields).find((f) => f.key === "pzResult")!;
    await reviewField(store, { id: field.id, action: "approve" });
    deps.download.mockResolvedValue(new Uint8Array([4, 5, 6])); deps.extract.mockResolvedValue(extraction());
    await ingestDocuments(store, [document], deps);
    expect(publicFields(await store.read(), caseIds)).toEqual([]);
    await expect(reviewField(store, { id: field.id, action: "approve" })).rejects.toThrow("changed");
  });
  it("does not discard published evidence during a download outage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = memoryStore(), deps = dependencies(); await ingestDocuments(store, [document], deps);
    deps.download.mockRejectedValue(new Error("HTTP 403"));
    const run = await ingestDocuments(store, [document], deps);
    expect(run.errors[0]).toContain("HTTP 403");
    expect(publicFields(await store.read(), caseIds)).toHaveLength(2);
  });
  it("caches text through extraction failures and preserves rejections on rerun", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = memoryStore(), deps = dependencies(); deps.extract.mockRejectedValueOnce(new Error("temporary failure"));
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
    await ingestDocuments(store, [document], deps);
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    await ingestDocuments(store, [document], deps);
    expect(deps.text).toHaveBeenCalledTimes(1);
    const field = Object.values((await store.read()).fields).find((f) => f.key === "pzResult")!;
    await reviewField(store, { id: field.id, action: "reject", note: "wrong outcome" });
    const count = deps.extract.mock.calls.length;
    await ingestDocuments(store, [document], deps);
    expect(deps.extract).toHaveBeenCalledTimes(count);
    expect((await store.read()).fields[field.id].status).toBe("rejected");
  });
  it("resumes a partially extracted shared document without repeating completed case calls", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = memoryStore(), deps = dependencies();
    deps.extract.mockResolvedValueOnce(decision()).mockRejectedValueOnce(new Error("second case failed"));
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
    await ingestDocuments(store, [document], deps);
    expect(publicFields(await store.read(), caseIds)).toEqual([]);
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    await ingestDocuments(store, [document], deps);
    expect(deps.extract).toHaveBeenCalledTimes(3);
    expect(deps.text).toHaveBeenCalledTimes(1);
    expect(publicFields(await store.read(), caseIds)).toHaveLength(2);
  });
  it("omits an unsupported field while retaining verified evidence and unchanged-document caching", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = memoryStore(), deps = dependencies();
    const unitQuote = "The proposal contains 487 single-family homes.";
    deps.text.mockResolvedValue([{ page: 1, text: unitQuote, method: "native" }]);
    deps.extract.mockResolvedValue(extraction({ requestSummary: { value: "An unsupported summary", page: 1, quote: "A quote that does not appear in this document", confidence: 1 }, units: { value: "487", page: 1, quote: unitQuote, confidence: 0.99 } }));
    const run = await ingestDocuments(store, [document], deps);
    expect(run.processed).toBe(1); expect(run.errors).toEqual([]);
    const state = await store.read();
    expect(publicFields(state, caseIds).every((field) => field.key === "units")).toBe(true);
    expect(publicFields(state, caseIds)).toHaveLength(2);
    expect(state.documents[digest(document.url)].validationWarnings).toHaveLength(2);
    await ingestDocuments(store, [document], deps);
    expect(deps.extract).toHaveBeenCalledTimes(2);
  });
  it("does not present a report's workflow heading as a staff position", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = memoryStore(), deps = dependencies();
    const heading = "Recommendation to City Council";
    deps.text.mockResolvedValue([{ page: 1, text: "Public hearing item. (Action: " + heading + ")", method: "native" }]);
    deps.extract.mockResolvedValue(extraction({ staffRecommendation: { value: heading, page: 1, quote: heading, confidence: 1 } }));
    await ingestDocuments(store, [{ ...document, kind: "staff-report" }], deps);
    expect(publicFields(await store.read(), caseIds)).toEqual([]);
    await store.mutate((state) => { const source = state.documents[digest(document.url)]; state.fields.legacy = { id: "legacy", documentId: source.id, documentHash: source.hash, caseId: caseIds[0], key: "staffRecommendation", value: heading, quote: heading, page: 1, sourceUrl: document.url, sourceKind: "staff-report", confidence: 1, status: "auto_published", createdAt: "" }; });
    expect(publicFields(await store.read(), caseIds)).toEqual([]);
  });
  it("does not publish a decision asserted in a staff report", async () => {
    const store = memoryStore(); await ingestDocuments(store, [{ ...document, kind: "staff-report" }], dependencies());
    expect(Object.values((await store.read()).fields).some((field) => field.key === "pzResult")).toBe(false);
  });
  it("requires review of OCR-derived facts even at high confidence", async () => {
    const store = memoryStore(), deps = dependencies(); deps.text.mockResolvedValue([{ ...pages[0], method: "ocr" }]);
    await ingestDocuments(store, [document], deps);
    expect(publicFields(await store.read(), caseIds)).toEqual([]);
  });
  it("requires approved final decisions for both related cases", async () => {
    const store = memoryStore(), deps = dependencies();
    deps.extract.mockResolvedValue(extraction({ councilDecision: { value: "approved", page: 1, quote, confidence: 1 } }));
    await ingestDocuments(store, [{ ...document, kind: "council-decision" }], deps);
    const input = { caseIds, stage: "Decided" as const };
    expect(buildTimeline(await store.read(), input).finalDecisionApproved).toBe(false);
    expect(buildTimeline(await store.read(), input).currentStage).not.toBe("Decided");
    const fields = Object.values((await store.read()).fields);
    await reviewField(store, { id: fields[0].id, action: "approve" });
    expect(buildTimeline(await store.read(), input).finalDecisionApproved).toBe(false);
    await reviewField(store, { id: fields[1].id, action: "approve" });
    expect(buildTimeline(await store.read(), input).currentStage).toBe("Decided");
  });
  it("retains edited values and a review audit", async () => {
    const store = memoryStore(); await ingestDocuments(store, [document], dependencies());
    const field = Object.values((await store.read()).fields).find((f) => f.key === "pzResult")!;
    await reviewField(store, { id: field.id, action: "approve", value: "continued", note: "Corrected against letter" });
    const state = await store.read();
    expect(state.fields[field.id].value).toBe("continued");
    expect(state.audit[0]).toMatchObject({ action: "edit", previousValue: "recommend approval", value: "continued" });
  });
});

describe("evidence validation and access", () => {
  it("rejects invented quotes, missing pages, and invalid confidence", () => {
    expect(() => validateExtraction(extraction({ pzResult: { value: "recommend approval", page: 1, quote: "A quote which is not in this document.", confidence: 1 } }), pages)).toThrow("quote not found");
    expect(() => validateExtraction(extraction({ pzResult: { value: "recommend approval", page: 2, quote, confidence: 1 } }), pages)).toThrow("quote not found");
    expect(() => validateExtraction(extraction({ pzResult: { value: "recommend approval", page: 1, quote, confidence: 2 } }), pages)).toThrow("confidence");
  });
  it("never exposes a decision incorrectly marked auto-published", async () => {
    const store = memoryStore(); await ingestDocuments(store, [document], dependencies());
    await store.mutate((state) => { for (const field of Object.values(state.fields)) field.status = "auto_published"; });
    expect(publicFields(await store.read(), caseIds).every((field) => field.key === "pzHearingDate")).toBe(true);
  });
  it("restricts ingestion to official HTTPS document hosts", () => {
    expect(officialDocumentUrl(document.url)).toBe(true);
    expect(officialDocumentUrl("https://nampa.primegov.com.evil.example/doc.pdf")).toBe(false);
    expect(officialDocumentUrl("http://127.0.0.1/private")).toBe(false);
  });
  it("fails closed without an admin password and compares complete secrets", () => {
    vi.stubEnv("REVIEW_ADMIN_PASSWORD", "");
    expect(authorizedReviewer("Basic " + Buffer.from("admin:").toString("base64"))).toBe(false);
    expect(authorizedReviewer("Basic " + Buffer.from("admin:correct-password").toString("base64"), "correct-password")).toBe(true);
    expect(authorizedReviewer("Basic " + Buffer.from("admin:wrong").toString("base64"), "correct-password")).toBe(false);
    expect(secretMatches("", undefined)).toBe(false);
  });
  it("serializes local writes and prevents overlapping jobs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "law-evidence-"));
    try {
      const store = createFileStore(path.join(directory, "evidence.json"));
      await Promise.all(Array.from({ length: 5 }, (_, i) => store.mutate((state) => { state.cursor = (state.cursor ?? "") + i; })));
      expect((await store.read()).cursor).toHaveLength(5);
      const lease = await acquireLease(store, "job");
      expect(lease).toBeTruthy(); expect(await acquireLease(store, "job")).toBeNull();
      await releaseLease(store, "job", "wrong-token"); expect(await acquireLease(store, "job")).toBeNull();
      await releaseLease(store, "job", lease!); expect(await acquireLease(store, "job")).toBeTruthy();
      expect(digest("a")).not.toBe(digest("b"));
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
