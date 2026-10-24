import type { Hearing } from "./types";
import { getProjectForCase, getProjectNextHearing, type ProjectStage } from "@/lib/projects";

export function latestCouncilDecision(hearing: Hearing) {
  const latest = hearing.meetings.filter((m) => /council|board/i.test(m.body) && (m.result || m.continuedNote))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return latest?.result && /^(approved|denied)\b/i.test(latest.result.trim()) ? latest : undefined;
}

export function isStatusUnclear(hearing: Hearing): boolean {
  return Number(hearing.appId.slice(-4)) < new Date().getFullYear() && !hearing.decisionRecorded && !hearing.energovPlanId && !hearing.externalUrl && !hearing.meetings.length;
}

export function getCaseStatus(hearing: Hearing): string {
  const decision = latestCouncilDecision(hearing);
  if (decision) return "Decided (" + (/^approved/i.test(decision.result!) ? "Approved" : "Denied") + ")";
  return isStatusUnclear(hearing) ? "Status unclear, no recent city record" : getCaseStage(hearing);
}

/** One public stage label; raw GIS/portal statuses stay in source data only. */
export function getCaseStage(hearing: Hearing, completed = false, now = new Date()): ProjectStage {
  // A published Council outcome takes precedence over stale GIS phases or schedules.
  if (latestCouncilDecision(hearing)) return "Decided";
  completed ||= hearing.decisionRecorded === true;
  const project = getProjectForCase(hearing.appId);
  const knownNext = project && getProjectNextHearing(project, { active: completed ? [] : [hearing], completed: completed ? [hearing] : [] }, now);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const next = hearing.meetings.filter((m) => !m.continuedNote && m.date >= today).sort((a,b) => a.date.localeCompare(b.date))[0];
  if (!completed && (next || knownNext)) return hearing.appPhase === "City Council" || /council|board/i.test(knownNext?.body ?? next?.body ?? "") ? "Council hearing" : "P&Z hearing";
  if (completed || /^(approved|denied|withdrawn|closed|completed)$/i.test(hearing.appStatus.trim()) || hearing.appPhase === "Recording") return "Decided";
  if (hearing.appPhase === "City Council") return "Council hearing";
  if (hearing.appPhase === "PZ Commission") return "P&Z hearing";
  if (hearing.appPhase === "Review" || hearing.appPhase === "Notification" || /review|pending/i.test(hearing.appStatus)) return "Under review";
  return "Submitted";
}
