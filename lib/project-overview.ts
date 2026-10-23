import type { EvidenceField } from "./timeline/types";
import { evidenceSourceHref } from "./timeline/types";
import { latestField, type TimelineData } from "./timeline/public";
import type { ProjectCaseDocuments } from "./project-documents";
import { uniqueDocumentLinks } from "./case-details";

export type SourcedFact = { value: string; url: string; page?: number };
export type ProjectOverview = {
  variant?: "residential" | "zoning" | "nonresidential" | "mixed-use";
  request?: SourcedFact; use?: SourcedFact; buildingArea?: SourcedFact; currentJurisdiction?: SourcedFact;
  homes?: SourcedFact; acres?: SourcedFact; zoning?: SourcedFact; applicant?: SourcedFact;
  traffic?: SourcedFact; schools?: SourcedFact; summary?: string; summarySource?: SourcedFact;
  earlierNotice?: string;
};
export const BRAEBURN_REPORT = "https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=acf18754-7101-48d9-b4ea-f8398342a0fa";
// Editorial pilot values verified against the physical pages of the shared staff report.
// These supply proposal facts only; hearing outcomes always come from reviewed evidence.
export const braeburnOverview: ProjectOverview = {
  homes: { value: "487", url: BRAEBURN_REPORT, page: 1 },
  acres: { value: "138.03", url: BRAEBURN_REPORT, page: 24 },
  zoning: { value: "RS4, RS6 and RS7 (Single-Family Residential)", url: BRAEBURN_REPORT, page: 1 },
  applicant: { value: "Toll Brothers", url: BRAEBURN_REPORT, page: 1 },
  traffic: { value: "The staff report calls for 10-foot paths, drainage and traffic-study-related widening along Amity Avenue and Happy Valley Road, plus full pavement widening on Cruse Lane/Pit Lane.", url: BRAEBURN_REPORT, page: 2 },
  earlierNotice: "Updated from March notice (~500 homes on 137 acres).",
};
export function sourcedField(field?: EvidenceField): SourcedFact | undefined {
  return field && { value: field.value, url: field.sourceUrl, page: field.page ?? undefined };
}
export function factHref(fact: SourcedFact) { return evidenceSourceHref({ sourceUrl: fact.url, page: fact.page ?? null }); }
export function projectOverview(data: TimelineData, editorial: ProjectOverview = {}): ProjectOverview {
  const report = data.fields.filter((f) => f.sourceKind === "staff-report");
  return {
    ...editorial,
    homes: sourcedField(latestField(report,"units")) ?? editorial.homes,
    acres: sourcedField(latestField(report,"acres")) ?? editorial.acres,
    zoning: sourcedField(latestField(report,"zoningRequested")) ?? editorial.zoning,
    applicant: sourcedField(latestField(report,"applicantCompany")) ?? editorial.applicant,
    traffic: sourcedField(latestField(report,"trafficSummary")) ?? editorial.traffic,
    schools: sourcedField(latestField(report,"schoolComment")) ?? editorial.schools,
  };
}
export function numericFact(fact?: SourcedFact) { const number = fact && Number(fact.value.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0]); return number && Number.isFinite(number) ? number : undefined; }
export function projectDensity(overview: ProjectOverview): string | undefined {
  const homes = numericFact(overview.homes), acres = numericFact(overview.acres);
  return homes && acres ? "~" + (homes / acres).toFixed(1) + " homes/acre" : undefined;
}
export function projectDocumentList(groups: ProjectCaseDocuments[]) {
  const all = uniqueDocumentLinks(groups.flatMap((g) => g.documents));
  const key = all.filter((d) => /staff[\s_-]*report|decision[\s_-]*letter|reasoned|findings|site[\s_-]*plan|concept|prelim(?:inary)?[\s_-]*plat/i.test(d.label));
  const order = (label: string) => /staff[\s_-]*report/i.test(label) ? 0 : /decision|reasoned|findings/i.test(label) ? 1 : 2;
  key.sort((a,b) => order(a.label)-order(b.label));
  return { key, other: all.filter((d) => !key.includes(d)) };
}
