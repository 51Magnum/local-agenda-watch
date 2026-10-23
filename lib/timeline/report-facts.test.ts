import { describe, expect, it } from "vitest";
import { explicitReportFacts } from "./report-facts";
import { validateExtraction } from "./extract";
import { buildTimeline } from "./public";
import { emptyEvidenceState, type PageText, type SourceDocument } from "./types";
import type { EnerGovPlan } from "../sources/energov";

const document: SourceDocument = { kind: "staff-report", title: "Braeburn Creek Staff Report", url: "https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=acf18754-7101-48d9-b4ea-f8398342a0fa", caseIds: ["ANN-00371-2026", "SPP-00184-2026"] };
// Literal excerpts from physical pages 1, 2 and 24 of the official report.
const pages: PageText[] = [
  { page: 1, method: "native", text: "Annexation & Zoning to RS4, RS6 and RS7 (Single-Family Residential) zoning districts with a development agreement and Subdivision Preliminary Plat for Braeburn Creek on two parcels for Toll Brothers representing Brandi & Ben Krajnick (ANN-00371-2026, SPP-00184-2026). Original Concept: Development of 487 single-family detached unit lots (RS4=144 lots; RS6=177 lots; RS7=166 lots) and 34 common area lots. (Action: Recommendation to City Council)" },
  { page: 2, method: "native", text: "Frontage road improvements will be required in accordance with Nampa City Code Section 9-3-1 to be reflected on final construction drawing including, Amity Avenue – 10-foot Side path, drainage. Happy Valley Road – 10-foot Side path, drainage. Cruse Ln/Pit Ln – 10-foot side path, drainage, full pavement widening." },
  { page: 24, method: "native", text: "Overall Total site area (acres) 138.03" },
];
describe("source-checked Braeburn report fallback", () => {
  it("retains the request, size, lots, zoning and conditions with exact quotes/pages for both cases", () => {
    for (const id of document.caseIds) {
      const fields = validateExtraction(explicitReportFacts(document, id, pages), pages);
      expect(fields.acres).toMatchObject({ value: "138.03", page: 24 });
      expect(fields.units).toMatchObject({ value: "487 single-family detached lots", page: 1 });
      expect(fields.keyConditions.page).toBe(2);
      expect(fields.requestSummary.value).toContain("Braeburn Creek");
      expect(fields.staffRecommendation.value).toBeNull();
      expect(fields.pzResult.value).toBeNull(); expect(fields.councilDecision.value).toBeNull();
    }
  });
  it("never borrows figures from a different report or a case mentioned only in an appendix", () => {
    expect(explicitReportFacts({ ...document, url: "https://nampa.primegov.com/other.pdf" }, document.caseIds[0], pages).acres.value).toBeNull();
    expect(explicitReportFacts(document, "ANN-00369-2026", pages).units.value).toBeNull();
    expect(explicitReportFacts(document, document.caseIds[0], [{ ...pages[0], text: "A different staff report." }, ...pages.slice(1)]).acres.value).toBeNull();
  });
  it("uses an explicit EnerGov review date and never substitutes the applied or last-action date", () => {
    const base = { caseIds: document.caseIds, stage: "Council hearing" as const };
    const record = { caseId: document.caseIds[0], plan: { ApplyDate: "2026-07-31", LastActionDate: "2026-10-01", ReviewDate: "2026-08-10" } as EnerGovPlan, sourceUrl: "https://nampaid-energovpub.tylerhost.net/Apps/SelfService#/plan/fixture" };
    const timeline = buildTimeline(emptyEvidenceState(), { ...base, plans: [record] });
    expect(timeline.fields.find((f) => f.key === "reviewDate")).toMatchObject({ value: "2026-08-10", sourceUrl: record.sourceUrl });
    delete record.plan.ReviewDate;
    expect(buildTimeline(emptyEvidenceState(), { ...base, plans: [record] }).fields.some((f) => f.key === "reviewDate")).toBe(false);
  });
});


import { vi } from "vitest";
import { ingestDocuments, digest } from "./ingest";
import { publicFields } from "./types";
it("ingests recovered report figures into the review store, removes obsolete warnings and skips unchanged extraction", async () => {
  const state = emptyEvidenceState();
  const store = { read: async () => structuredClone(state), mutate: async <T,>(fn: (draft: ReturnType<typeof emptyEvidenceState>) => T) => fn(state) };
  const empty = explicitReportFacts({ ...document, kind: "other" }, document.caseIds[0], pages);
  const extract = vi.fn().mockResolvedValue({ ...empty, acres: { value: "138.03", quote: "A quote which does not exist on that page", page: 1, confidence: 1 } });
  const download = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
  const deps = { download, text: async () => pages, extract };
  const run = await ingestDocuments(store, [document], deps);
  expect(run.processed).toBe(1); expect(run.errors).toEqual([]);
  expect(publicFields(state, document.caseIds).filter((f) => f.key === "acres")).toHaveLength(2);
  expect(state.documents[digest(document.url)].validationWarnings).toBeUndefined();
  expect((await ingestDocuments(store, [document], deps)).skipped).toBe(1);
  expect(extract).toHaveBeenCalledTimes(2);
});
