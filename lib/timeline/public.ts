import { cache } from "react";
import { getEvidenceStore } from "./store";
import { emptyEvidenceState, publicFields, type EvidenceField, type EvidenceState, type FieldKey } from "./types";
import type { EnerGovPlan } from "@/lib/sources/energov";
import type { Hearing } from "@/lib/localities/types";
import type { ProjectHearing, ProjectStage } from "@/lib/projects";

export function timelineEnabled(caseId: string): boolean {
  const configured = process.env.TIMELINE_CASE_IDS ?? "ANN-00371-2026,SPP-00184-2026";
  return configured === "*" || configured.split(",").map((value) => value.trim()).includes(caseId);
}
export const readTimelineState = cache(async (): Promise<EvidenceState> => {
  try { return await getEvidenceStore().read(); }
  catch (error) { console.error("[timeline:public] Evidence unavailable", error instanceof Error ? error.message : "Unknown error"); return emptyEvidenceState(); }
});
export type TimelineAppearance = { date: string; body: string; sourceUrl: string; isHearing: boolean };
export type TimelineData = {
  fields: EvidenceField[];
  appearances: TimelineAppearance[];
  finalDecisionApproved: boolean;
  currentStage: ProjectStage;
  caseIds: string[];
  next?: ProjectHearing;
};
export function latestField(fields: EvidenceField[], key: FieldKey): EvidenceField | undefined {
  return fields.filter((field) => field.key === key).sort((a, b) =>
    Number(b.status === "approved") - Number(a.status === "approved") ||
    (/Date$/.test(key) ? b.value.localeCompare(a.value) : (b.reviewedAt ?? b.createdAt).localeCompare(a.reviewedAt ?? a.createdAt)))[0];
}
export function buildTimeline(state: EvidenceState, input: { caseIds: string[]; stage: ProjectStage; next?: ProjectHearing; plans?: { caseId: string; plan: EnerGovPlan; sourceUrl: string }[]; hearings?: Hearing[] }): TimelineData {
  const fields = publicFields(state, input.caseIds);
  for (const record of input.plans ?? []) {
    if (record.plan.ApplyDate && /^\d{4}-\d{2}-\d{2}/.test(record.plan.ApplyDate) && !fields.some((field) => field.caseId === record.caseId && field.key === "appliedDate")) fields.push({
      id: "live-applied-" + record.caseId, caseId: record.caseId, key: "appliedDate", value: record.plan.ApplyDate.slice(0, 10), sourceUrl: record.sourceUrl, page: null,
      quote: "ApplyDate: " + record.plan.ApplyDate, confidence: 1, sourceKind: "case-record", status: "auto_published", documentId: "live-record", documentHash: "live-record", createdAt: "",
    });
  }
  const appearances: TimelineAppearance[] = [];
  for (const document of Object.values(state.documents)) {
    if (document.state !== "complete" || !document.caseIds.some((id) => input.caseIds.includes(id)) || !document.meeting) continue;
    appearances.push({ ...document.meeting, sourceUrl: document.url });
  }
  for (const hearing of input.hearings ?? []) for (const meeting of hearing.meetings) {
    if (!meeting.continuedNote) appearances.push({ date: meeting.date, body: meeting.body, sourceUrl: meeting.agendaUrl ?? meeting.sourceUrl, isHearing: true });
  }
  const finalDecisionApproved = input.caseIds.every((caseId) => fields.some((field) => field.caseId === caseId && field.key === "councilDecision" && field.status === "approved" && ["approved", "denied", "withdrawn"].includes(field.value)));
  return { fields, caseIds: input.caseIds, appearances: [...new Map(appearances.map((a) => [a.body + a.date, a])).values()].sort((a, b) => a.date.localeCompare(b.date)), finalDecisionApproved,
    currentStage: finalDecisionApproved ? "Decided" : input.stage === "Decided" ? "Council hearing" : input.stage,
    next: finalDecisionApproved ? undefined : input.next };
}
