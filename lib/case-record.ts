import { cache } from "react";
import { findHearing, getLocality } from "@/lib/localities";
import type { EnerGovAttachment, EnerGovPlan } from "@/lib/sources/energov";

/** Share the same record and summary inputs between metadata and page rendering. */
export const getCaseRecord = cache(async (planNumber: string) => {
  const locality = getLocality("nampa");
  if (!locality?.energov || !locality.getHearings) return null;
  const feed = await locality.getHearings();
  const completed = findHearing(feed.completed, planNumber);
  const found = findHearing(feed.active, planNumber) ?? completed ?? findHearing(feed.upcomingOnly ?? [], planNumber);
  if (!found) return null;
  const hearing = completed ? { ...found, decisionRecorded: true } : found;
  let attachmentsUnavailable = false;
  const [plan, attachments]: [EnerGovPlan | null, EnerGovAttachment[]] = hearing.energovPlanId ? await Promise.all([
    locality.energov.getPlan(hearing.energovPlanId).catch((err: unknown) => { console.error("[case-record] Plan unavailable", err); return null; }),
    locality.energov.getPlanAttachments(hearing.energovPlanId).catch((err: unknown) => { console.error("[case-record] Attachments unavailable", err); attachmentsUnavailable = true; return []; }),
  ]) : [null, []];
  return { locality, feed, hearing, plan, attachments, attachmentsUnavailable };
});
