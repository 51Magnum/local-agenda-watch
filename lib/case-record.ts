import {residentialCase,redactResidence,privateResidentialDocument} from "./residential-privacy";
import {privacyOverrides} from "./residential-privacy-store";
import{FEATURED_AREA_ID}from"./areas/registry";
import { caseCatalog } from "./case-catalog";
import { cache } from "react";
import { findHearing, getLocality } from "@/lib/localities";
import type { EnerGovAttachment, EnerGovPlan } from "@/lib/sources/energov";

/** Share the same record and summary inputs between metadata and page rendering. */
export const getCaseRecord = cache(async (planNumber: string,areaId=FEATURED_AREA_ID) => {
  const locality = getLocality(areaId);
  if (!locality?.energov || !locality.getHearings) return null;
  const feed = await locality.getHearings();
  const completed = findHearing(feed.completed, planNumber);
  const found = findHearing(caseCatalog(feed), planNumber);
  if (!found) return null;
  const hearing = completed ? { ...found, decisionRecorded: true } : found;
  let attachmentsUnavailable = false;
  const [plan, attachments]: [EnerGovPlan | null, EnerGovAttachment[]] = hearing.energovPlanId ? await Promise.all([
    locality.energov.getPlan(hearing.energovPlanId).catch((err: unknown) => { console.error("[case-record] Plan unavailable", err); return null; }),
    locality.energov.getPlanAttachments(hearing.energovPlanId).catch((err: unknown) => { console.error("[case-record] Attachments unavailable", err); attachmentsUnavailable = true; return []; }),
  ]) : [null, []];
  const residentialPrivacy=residentialCase(areaId,hearing.appId,{hearing,plan},await privacyOverrides());
  return { locality, feed, hearing:residentialPrivacy?redactResidence(hearing):hearing, plan:residentialPrivacy?redactResidence(plan):plan, attachments:residentialPrivacy?redactResidence(attachments.filter(a=>!privateResidentialDocument(a.FileName+" "+a.Notes))):attachments, attachmentsUnavailable, residentialPrivacy };
});
