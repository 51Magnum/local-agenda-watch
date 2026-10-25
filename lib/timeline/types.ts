export const EXTRACTED_KEYS = ["popupHeadline", "popupExplanation", "requestSummary", "acres", "units", "zoningRequested", "staffRecommendation", "keyConditions", "trafficSummary", "schoolComment", "nearbySchools", "densityContext", "buildingHeight", "parksOpenSpace", "constructionTiming", "applicantCompany", "pzConditions", "pzSpeakersFor", "pzSpeakersAgainst", "pzSpeakersNeutral", "councilConditions", "councilSpeakersFor", "councilSpeakersAgainst", "councilSpeakersNeutral", "pzHearingDate", "pzResult", "pzVote", "councilHearingDate", "councilDecision", "councilVote", "decisionDate"] as const;
export type ExtractedKey = typeof EXTRACTED_KEYS[number];
export type FieldKey = ExtractedKey | "appliedDate" | "caseStatus" | "lastActionDate" | "reviewDate";
export const DECISION_KEYS = new Set<FieldKey>(["pzResult", "pzVote", "pzConditions", "pzSpeakersFor", "pzSpeakersAgainst", "pzSpeakersNeutral", "councilConditions", "councilSpeakersFor", "councilSpeakersAgainst", "councilSpeakersNeutral", "councilDecision", "councilVote", "decisionDate"]);
export const FIELD_LABELS: Record<FieldKey, string> = {
  popupHeadline: "Map headline", popupExplanation: "Map explanation", requestSummary: "Request", acres: "Acres", units: "Homes / lots", zoningRequested: "Requested zoning", staffRecommendation: "Staff recommendation", keyConditions: "Main conditions",
  pzHearingDate: "P&Z hearing", pzResult: "P&Z result", pzVote: "P&Z vote", councilHearingDate: "Council hearing", councilDecision: "Council decision", councilVote: "Council vote", decisionDate: "Decision date",
  nearbySchools:"Nearby schools", densityContext:"Density and surrounding zoning", buildingHeight:"Building height", parksOpenSpace:"Parks and open space", constructionTiming:"Construction timing", trafficSummary: "Traffic and road improvements", schoolComment: "School district comment", applicantCompany: "Applicant company", pzConditions: "P&Z recommended conditions", pzSpeakersFor: "P&Z speakers in support", pzSpeakersAgainst: "P&Z speakers opposed",
  pzSpeakersNeutral: "P&Z neutral speakers", councilConditions: "Council/Board conditions", councilSpeakersFor: "Council/Board speakers in support", councilSpeakersAgainst: "Council/Board speakers opposed", councilSpeakersNeutral: "Council/Board neutral speakers",
  appliedDate: "Applied", caseStatus: "City case status", lastActionDate: "Last city action", reviewDate: "Under review",
};
export type DocumentKind = "staff-report" | "pz-decision" | "council-decision" | "findings" | "minutes" | "agenda" | "case-record" | "other";
export type PageText = { page: number; text: string; method: "native" | "ocr" | "structured" };
export type SourceDocument = { caseContexts?: {caseIds:string[];title:string}[]; areaId?: string; url: string; title: string; caseIds: string[]; kind: DocumentKind; content?: string; meeting?: { body: string; date: string; isHearing: boolean; minutesUrl?: string }; fields?: Array<{ key: FieldKey; value: string; quote: string; page: number | null }> };
export type StoredDocument = SourceDocument & { id: string; hash: string; structured?:boolean; pageCount?:number;contentNextPage?:number;contentTotalPages?:number; pages: PageText[]; checkedAt: string; extractedAt?: string; error?: string; extractionVersion?: string; processedCaseIds?: string[]; validationWarnings?: string[]; failCount?: number; lastAttemptAt?: string; state: "processing" | "complete" | "error" | "failed-permanent" };
export type Speaker = { name: string; position: "support" | "oppose" | "neutral"; quote: string; page: number };
export type Verification = { version: 1; case: boolean; body: boolean; quote: boolean; value: boolean; secondPass: boolean; reasons: string[]; speakers?: Speaker[]; checkedAt: string };
export const LOW_STAKES_KEYS = new Set<FieldKey>(["pzConditions", "councilConditions", "pzSpeakersFor", "pzSpeakersAgainst", "pzSpeakersNeutral", "councilSpeakersFor", "councilSpeakersAgainst", "councilSpeakersNeutral"]);
export type EvidenceField = {
  verification?: Verification; body?: string;
  areaId?: string; id: string; documentId: string; documentHash: string; caseId: string; key: FieldKey; value: string;
  sourceUrl: string; page: number | null; quote: string; confidence: number; sourceKind: DocumentKind;
  status: "pending" | "approved" | "rejected" | "auto_published";
  createdAt: string; reviewedAt?: string; originalValue?: string;
};
export type AuditEntry = { fieldId: string; at: string; action: "approve" | "edit" | "reject" | "undo"; key?: FieldKey; areaId?: string; batchId?: string; previousStatus?: EvidenceField["status"]; previousReviewedAt?: string; previousOriginalValue?: string; previousValue: string; value: string; note: string };
export type UsageCall = { at: string; areaId: string; documentId?: string; operation: string; inputTokens: number; outputTokens: number; totalTokens: number };
export type HostCheck = { areaId: string; host: string; outcome: "worked" | "blocked" | "unavailable"; detail?: string };
export type AreaRunCount = { cases: number; visited: number; documents: number; extracted: number; processed?:number };
export type IngestionRun = { costUsd?:number; modes?:string[]; startedAt: string; finishedAt?: string; checked: number; processed: number; skipped: number; errors: string[]; tokenTotals?:{calls:number;input:number;output:number;total:number}; transfer?:{byStore?:Record<string,number>;timelineReadBytes?:number;readBytes:number;writeBytes:number;queries:number;legacyRowBytes?:number}; usage?: UsageCall[]; hosts?: HostCheck[]; areas?: Record<string, AreaRunCount> };
export type EvidenceState = { version: 1; documents: Record<string, StoredDocument>; fields: Record<string, EvidenceField>; audit: AuditEntry[]; runs: IngestionRun[]; leases: Record<string, { token: string; expiresAt: number }>; cursor?: string; cursors?: Record<string,string>; folderQueues?: Record<string,string[]>; discoveryText?: Record<string,{hash:string;pages:PageText[];checkedAt:string}>; retryAudit?: {documentId:string;at:string}[] };
export function emptyEvidenceState(): EvidenceState { return { version: 1, documents: {}, fields: {}, audit: [], runs: [], leases: {} }; }
/** A report's action heading identifies workflow, not staff's position on approval. */
export function isWorkflowRecommendation(value: string): boolean {
  return /^\s*\(?(?:Action:\s*)?Recommendation to (?:City )?Council\)?[.\s]*$/i.test(value);
}
export function verifiedAutoField(field:EvidenceField):boolean {
 const v=field.verification;
 return field.status==="auto_published"&&LOW_STAKES_KEYS.has(field.key)&&field.confidence>=.9&&v?.version===1&&v.case&&v.body&&v.quote&&v.value&&v.secondPass;
}
export function isPublicField(field: EvidenceField, state: EvidenceState): boolean {
  if (field.key === "staffRecommendation" && isWorkflowRecommendation(field.value)) return false;
  const current = state.documents[field.documentId];
  return Boolean(current && current.hash === field.documentHash && current.state === "complete" &&
    (field.status === "approved" || (field.status === "auto_published" && (!DECISION_KEYS.has(field.key) || verifiedAutoField(field)))));
}
export function publicFields(state: EvidenceState, caseIds: string[], areaId = "nampa"): EvidenceField[] {
  return Object.values(state.fields).filter((field) => (field.areaId ?? "nampa") === areaId && caseIds.includes(field.caseId) && isPublicField(field, state));
}
export function evidenceSourceHref(field: Pick<EvidenceField, "sourceUrl" | "page">): string {
  if (field.sourceUrl.includes("tylerhost.net/Apps/SelfService#/plan/")) return field.sourceUrl;
  return field.page ? field.sourceUrl.split("#")[0] + "#page=" + field.page : field.sourceUrl;
}
