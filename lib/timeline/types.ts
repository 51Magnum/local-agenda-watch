export const EXTRACTED_KEYS = ["requestSummary", "acres", "units", "zoningRequested", "staffRecommendation", "keyConditions", "trafficSummary", "schoolComment", "applicantCompany", "pzConditions", "pzSpeakersFor", "pzSpeakersAgainst", "pzHearingDate", "pzResult", "pzVote", "councilHearingDate", "councilDecision", "councilVote", "decisionDate"] as const;
export type ExtractedKey = typeof EXTRACTED_KEYS[number];
export type FieldKey = ExtractedKey | "appliedDate" | "caseStatus" | "lastActionDate" | "reviewDate";
export const DECISION_KEYS = new Set<FieldKey>(["pzResult", "pzVote", "pzConditions", "pzSpeakersFor", "pzSpeakersAgainst", "councilDecision", "councilVote", "decisionDate"]);
export const FIELD_LABELS: Record<FieldKey, string> = {
  requestSummary: "Request", acres: "Acres", units: "Homes / lots", zoningRequested: "Requested zoning", staffRecommendation: "Staff recommendation", keyConditions: "Main conditions",
  pzHearingDate: "P&Z hearing", pzResult: "P&Z result", pzVote: "P&Z vote", councilHearingDate: "Council hearing", councilDecision: "Council decision", councilVote: "Council vote", decisionDate: "Decision date",
  trafficSummary: "Traffic and road improvements", schoolComment: "School district comment", applicantCompany: "Applicant company", pzConditions: "P&Z recommended conditions", pzSpeakersFor: "P&Z speakers in support", pzSpeakersAgainst: "P&Z speakers opposed",
  appliedDate: "Applied", caseStatus: "City case status", lastActionDate: "Last city action", reviewDate: "Under review",
};
export type DocumentKind = "staff-report" | "pz-decision" | "council-decision" | "findings" | "minutes" | "agenda" | "case-record" | "other";
export type PageText = { page: number; text: string; method: "native" | "ocr" | "structured" };
export type SourceDocument = { url: string; title: string; caseIds: string[]; kind: DocumentKind; content?: string; meeting?: { body: string; date: string; isHearing: boolean; minutesUrl?: string }; fields?: Array<{ key: FieldKey; value: string; quote: string; page: number | null }> };
export type StoredDocument = SourceDocument & { id: string; hash: string; pages: PageText[]; checkedAt: string; extractedAt?: string; error?: string; extractionVersion?: string; processedCaseIds?: string[]; validationWarnings?: string[]; state: "processing" | "complete" | "error" };
export type EvidenceField = {
  id: string; documentId: string; documentHash: string; caseId: string; key: FieldKey; value: string;
  sourceUrl: string; page: number | null; quote: string; confidence: number; sourceKind: DocumentKind;
  status: "pending" | "approved" | "rejected" | "auto_published";
  createdAt: string; reviewedAt?: string; originalValue?: string;
};
export type AuditEntry = { fieldId: string; at: string; action: "approve" | "edit" | "reject"; previousValue: string; value: string; note: string };
export type IngestionRun = { startedAt: string; finishedAt?: string; checked: number; processed: number; skipped: number; errors: string[] };
export type EvidenceState = { version: 1; documents: Record<string, StoredDocument>; fields: Record<string, EvidenceField>; audit: AuditEntry[]; runs: IngestionRun[]; leases: Record<string, { token: string; expiresAt: number }>; cursor?: string };
export function emptyEvidenceState(): EvidenceState { return { version: 1, documents: {}, fields: {}, audit: [], runs: [], leases: {} }; }
/** A report's action heading identifies workflow, not staff's position on approval. */
export function isWorkflowRecommendation(value: string): boolean {
  return /^\s*\(?(?:Action:\s*)?Recommendation to (?:City )?Council\)?[.\s]*$/i.test(value);
}
export function isPublicField(field: EvidenceField, state: EvidenceState): boolean {
  if (field.key === "staffRecommendation" && isWorkflowRecommendation(field.value)) return false;
  const current = state.documents[field.documentId];
  return Boolean(current && current.hash === field.documentHash && current.state === "complete" &&
    (field.status === "approved" || (!DECISION_KEYS.has(field.key) && field.status === "auto_published")));
}
export function publicFields(state: EvidenceState, caseIds: string[]): EvidenceField[] {
  return Object.values(state.fields).filter((field) => caseIds.includes(field.caseId) && isPublicField(field, state));
}
export function evidenceSourceHref(field: Pick<EvidenceField, "sourceUrl" | "page">): string {
  if (field.sourceUrl.includes("tylerhost.net/Apps/SelfService#/plan/")) return field.sourceUrl;
  return field.page ? field.sourceUrl.split("#")[0] + "#page=" + field.page : field.sourceUrl;
}
