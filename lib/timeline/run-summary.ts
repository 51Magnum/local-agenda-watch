import { publicFields, type EvidenceState } from "./types";
import { officialDocumentUrl } from "./ingest";

/** Safe worker diagnostics: field names and availability only, never source contents or credentials. */
export function reviewRunSummary(state: EvidenceState, caseIds: string[]) {
  return caseIds.map((caseId) => {
    const documents = Object.values(state.documents).filter((d) => d.caseIds.includes(caseId));
    const current = Object.values(state.fields).filter((f) => f.caseId === caseId && state.documents[f.documentId]?.hash === f.documentHash && state.documents[f.documentId]?.state === "complete");
    const record = documents.find((d) => d.kind === "case-record" && d.state === "complete");
    let recordDateFields: string[] = [];
    let pzAttachment: { listed: boolean; public?: boolean; online?: boolean; verifiedDownload?: boolean } = { listed: false };
    try {
      const data = record?.content ? JSON.parse(record.content) : null;
      recordDateFields = Object.keys(data?.plan ?? {}).filter((key) => /date/i.test(key) && data.plan[key] != null && data.plan[key] !== "");
      const file = (data?.attachments ?? []).find((a: { FileName: string }) => /Decision[ _-]*Letter[ _-]*PZ\.pdf$/i.test(a.FileName));
      if (file) pzAttachment = { listed: true, public: !file.IsFileSecure, ...(typeof file.IsOnline === "boolean" ? { online: file.IsOnline } : {}), verifiedDownload: Boolean(file.FilePath && officialDocumentUrl(file.FilePath)) };
    } catch { /* A missing/older structured record is reported as unavailable. */ }
    return { caseId, caseRecordAvailable: Boolean(record), recordDateFields, pzAttachment,
      decisionDocuments: documents.filter((d) => d.kind === "pz-decision").map((d) => ({ state: d.state, fields: current.filter((f) => f.documentId === d.id).map((f) => f.key) })),
      pendingFields: [...new Set(current.filter((f) => f.status === "pending").map((f) => f.key))],
      publishedFields: [...new Set(publicFields(state, [caseId]).map((f) => f.key))] };
  });
}
