import {hearingDateTime} from "@/lib/areas/format";
import {cleanResidentTitle,cleanResidentProse} from "@/lib/resident-copy";
import type { AreaDefinition } from "@/lib/areas/registry";
import type { Hearing, ScheduledMeeting } from "@/lib/localities/types";
import type { EvidenceField } from "@/lib/timeline/types";
import type { MapCase } from "./types";

const words = (s: string) => s.trim().split(/\s+/).length;
const caseCode = /\b(?:[A-Z]{1,4}-?\d{4,5}-\d{2,6}(?:-(?:APL|MOD))?)\b/g;
export function popupProjectName(title: string): string {
  return title.replace(caseCode, "").split(/[:—]/)[0].replace(/\(\s*\)/g, "").replace(/\s+/g, " ").replace(/[\s·–-]+$/, "").trim() || "Proposed development";
}
function shortDate(value: string, area: AreaDefinition, weekday = false) {
  return new Intl.DateTimeFormat("en-US", { timeZone: area.timezone, ...(weekday ? { weekday: "short" } : {}), month: "short", day: "numeric" }).format(new Date(value.slice(0, 10) + "T12:00:00Z")).replace(/,/g, "");
}
function meetingLabel(meeting: ScheduledMeeting, area: AreaDefinition) {
  const body = meeting.body === area.bodies.planning.id ? (area.type === "county" ? area.bodies.planning.label.replace(/ Commission$/, "") : area.bodies.planning.shortLabel) : meeting.body === area.bodies.decision.id ? area.bodies.decision.label : meeting.bodyLabel || meeting.body;
  const time = meeting.time?.match(/^(\d{1,2}):(\d{2})$/);
  return body + " · " + hearingDateTime(meeting.date, area.timezone) + (time ? " · " + (+time[1] % 12 || 12) + (time[2] === "00" ? "" : ":" + time[2]) + (+time[1] >= 12 ? " PM" : " AM") + (area.timezone==="America/Denver"?" Mountain Time":" "+area.timezone) : "");
}
/** Reuse previously extracted prose without another model call or mixing document revisions. */
export function popupApplicationCopy(fields: EvidenceField[]) {
  // Choose copy from ONE application document. Never combine an older unit count with newer acreage.
  const applicationFields = fields.filter(f => ["staff-report", "case-record"].includes(f.sourceKind));
  const document = applicationFields.filter(f => ["popupHeadline", "requestSummary", "units", "acres"].includes(f.key)).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0]?.documentId;
  const fact = (key: string) => applicationFields.find(f => f.documentId === document && f.key === key)?.value;
  const generated = fact("popupHeadline");
  const units = fact("units"), acres = fact("acres");
  const count = units?.match(/^[\d,]+/)?.[0], size = acres?.match(/^[\d,.]+$/)?.[0];
  const numericHeadline = count && size && /homes|single.family|dwell|residential/i.test(units!) ? count + " new homes on " + size + " acres" : undefined;
  const headline = generated && words(generated) <= 16 && !caseCode.test(generated) ? generated : numericHeadline;
  caseCode.lastIndex = 0;
  const requestSentence = fact("requestSummary")?.split(/(?<=[.!?])\s+/)[0];
  const explanation = fact("popupExplanation") ?? (requestSentence && words(requestSentence) <= 60 && !/parcel|section|township|landowner|representing|\bR\d{6,}|\b[A-Z]{2,4}-\d/i.test(requestSentence) ? requestSentence : undefined);
  return { headline, explanation: explanation && words(explanation) <= 60 ? explanation : undefined, source: applicationFields.find(f => f.documentId === document && f.key === (fact("popupExplanation") ? "popupExplanation" : "requestSummary")) };
}
/** Only public evidence is passed in; pending AI decisions never enter the model. */
export function buildPopupModel(item: MapCase, area: AreaDefinition, hearing?: Hearing, fields: EvidenceField[] = [], now = new Date()): NonNullable<MapCase["popup"]> {
  const newest = (key: string) => fields.filter(f => f.key === key).sort((a,b) => (b.reviewedAt ?? b.createdAt).localeCompare(a.reviewedAt ?? a.createdAt))[0];
  const projectName = cleanResidentTitle(popupProjectName(hearing?.displayTitle??item.title),item.typeLabel);
  const copy = popupApplicationCopy(fields);
  const headline = copy.headline ?? projectName, explanation = copy.explanation ? cleanResidentProse(copy.explanation) : undefined;
  const progress: NonNullable<MapCase["popup"]>["progress"] = [];
  const meetings = [...(hearing?.meetings ?? [])].sort((a,b) => a.date.localeCompare(b.date));
  const latestDecisionMeeting = [...meetings].reverse().find(m => (m.body === area.bodies.decision.id || /council|commissioners/i.test(m.body)) && m.result);
  const decisionMeeting = /^(approved|denied|withdrawn)\b/i.test(latestDecisionMeeting?.result ?? "") ? latestDecisionMeeting : undefined;
  const decision = newest("councilDecision"), decisionDate = newest("decisionDate")?.value;
  const outcome = (latestDecisionMeeting?.result ?? decision?.value)?.match(/^(approved|denied|withdrawn)\b/i)?.[0];
  const finalDate = decisionMeeting?.date ?? decisionDate;
  progress.push({ label: "Filed" + (newest("appliedDate") ? " · " + shortDate(newest("appliedDate")!.value, area) : ""), state: item.stage === "Filed" ? "current" : "done" });
  const planning = [...meetings].reverse().find(m => m.body !== area.bodies.decision.id && m.date <= (finalDate ?? "9999"));
  const pzResult = newest("pzResult")?.value ?? planning?.result;
  const pzDate = newest("pzHearingDate")?.value ?? planning?.date;
  const planningBody = planning && planning.body !== area.bodies.planning.id ? planning.bodyLabel : area.type === "county" ? area.bodies.planning.label.replace(/ Commission$/, "") : area.bodies.planning.shortLabel;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: area.timezone }).format(now);
  if (pzDate && pzDate <= today) progress.push({ label: planningBody + (pzResult ? " " + pzResult.replace(/^recommend /i, "recommended ").replace(/^approved$/i, "recommended approval").replace(/^denied$/i, "recommended denial") : " met; result pending") + " (" + shortDate(pzDate, area) + ")", state: pzResult ? "done" : "past" });
  if (outcome && /^(approved|denied|withdrawn)\b/i.test(outcome)) {
    progress.push({ label: outcome.charAt(0).toUpperCase() + outcome.slice(1).toLowerCase() + " by " + area.bodies.decision.shortLabel + (finalDate ? ", " + shortDate(finalDate, area) : ""), state: "current" });
  } else if (item.stage === "Decided" || item.stage === "Recorded") {
    const recordOutcome = hearing?.appStatus.trim().match(/^(approved|denied|withdrawn)\b/i)?.[0];
    const label = recordOutcome ? recordOutcome.charAt(0).toUpperCase() + recordOutcome.slice(1).toLowerCase() + " — "+area.type+" record" + (item.stage === "Recorded" ? " · Recorded" : "") : item.stage === "Recorded" ? "Recorded" : "Decided; outcome not specified in "+area.type+" record";
    progress.push({ label, state: "current" });
  } else {
    const upcoming = meetings.find(m => m.date >= today && !m.continuedNote);
    if (upcoming) progress.push({ label: meetingLabel(upcoming, area), state: "current" });
    else if (item.nextHearing) progress.push({ label: item.nextHearing.body + " · " + hearingDateTime(item.nextHearing.date, area.timezone), state: "current" });
    else progress.push({ label: "Under review, no hearing set yet", state: "current" });
    progress.push({ label: "Decision", state: "future" });
  }
  return { headline, ...(explanation && words(explanation) <= 60 ? { explanation, aiGenerated: true } : {}), projectName, progress };
}
