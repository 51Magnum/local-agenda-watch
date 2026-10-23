import { DECISION_KEYS, type EvidenceField } from "./types";
import type { EvidenceStore } from "./store";
export async function reviewField(store: EvidenceStore, input: { id: string; action: "approve" | "reject"; value?: string; note?: string }) {
  return store.mutate((state) => {
    const field = state.fields[input.id];
    if (!field) throw new Error("Field not found");
    const document = state.documents[field.documentId];
    if (!document || document.hash !== field.documentHash || document.state !== "complete") throw new Error("Source document changed or is incomplete; review the latest version");
    const originalValue = field.value;
    const value = input.value?.trim() ?? originalValue;
    if (input.action === "approve") {
      if (!value || value.length > 4000) throw new Error("A value of 1–4000 characters is required");
      if (/Date$/.test(field.key) && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a date in YYYY-MM-DD format");
      if (field.key === "pzResult" && !["recommend approval", "recommend denial", "continued"].includes(value)) throw new Error("Choose recommend approval, recommend denial, or continued");
      if (field.key === "councilDecision" && !["approved", "denied", "continued", "withdrawn"].includes(value)) throw new Error("Choose approved, denied, continued, or withdrawn");
      if (["pzSpeakersFor", "pzSpeakersAgainst"].includes(field.key) && !/^\d+$/.test(value)) throw new Error("Use a whole-number speaker count");
      field.originalValue ??= originalValue; field.value = value; field.status = "approved";
    } else field.status = "rejected";
    field.reviewedAt = new Date().toISOString();
    state.audit.push({ fieldId: field.id, at: field.reviewedAt, action: input.action === "reject" ? "reject" : originalValue === value ? "approve" : "edit", previousValue: originalValue, value: field.value, note: input.note?.slice(0, 2000) ?? "" });
    return field;
  });
}
export function needsDecisionApproval(field: EvidenceField): boolean { return DECISION_KEYS.has(field.key); }
