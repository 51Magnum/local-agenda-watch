import { expect, it } from "vitest";
import { reviewRunSummary } from "./run-summary";
import { emptyEvidenceState, type EvidenceField, type StoredDocument } from "./types";
it("reports queue/source availability without disclosing record contents, quotes or paths", () => {
  const state = emptyEvidenceState();
  state.documents.record = { id: "record", hash: "hash", kind: "case-record", caseIds: ["ANN-00371-2026"], content: JSON.stringify({ plan: { ApplyDate: "2026-07-31", ReviewStartDate: "2026-08-01", Secret: "private-fixture" }, attachments: [{ FileName: "ANN-00371-2026_Braeburn Creek_Decision Letter PZ.pdf", IsFileSecure: false, IsOnline: true, FilePath: "private-fixture" }] }), state: "complete" } as StoredDocument;
  state.fields.pending = { id: "pending", caseId: "ANN-00371-2026", documentId: "record", documentHash: "hash", key: "pzResult", value: "recommend approval", quote: "private-fixture", status: "pending" } as EvidenceField;
  const result = reviewRunSummary(state, ["ANN-00371-2026"]);
  expect(result[0]).toMatchObject({ caseRecordAvailable: true, recordDateFields: ["ApplyDate", "ReviewStartDate"], pzAttachment: { listed: true, public: true, online: true, verifiedDownload: false }, pendingFields: ["pzResult"], publishedFields: [] });
  expect(JSON.stringify(result)).not.toContain("private-fixture"); expect(JSON.stringify(result)).not.toContain("recommend approval");
});
