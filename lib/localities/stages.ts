import type { Hearing } from "./types";
import { getProjectForCase, getProjectNextHearing, type ProjectStage } from "@/lib/projects";

/** One public stage label; raw GIS/portal statuses stay in source data only. */
export function getCaseStage(hearing: Hearing, completed = false, now = new Date()): ProjectStage {
  completed ||= hearing.decisionRecorded === true;
  const project = getProjectForCase(hearing.appId);
  const knownNext = project && getProjectNextHearing(project, { active: completed ? [] : [hearing], completed: completed ? [hearing] : [] }, now);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const next = hearing.meetings.filter((m) => !m.continuedNote && m.date >= today).sort((a,b) => a.date.localeCompare(b.date))[0];
  if (!completed && (next || knownNext)) return /council/i.test(next?.body ?? knownNext!.body) ? "Council hearing" : "P&Z hearing";
  if (completed || /^(approved|denied|withdrawn|closed|completed)$/i.test(hearing.appStatus.trim()) || hearing.appPhase === "Recording") return "Decided";
  if (hearing.appPhase === "City Council") return "Council hearing";
  if (hearing.appPhase === "PZ Commission") return "P&Z hearing";
  if (hearing.appPhase === "Review" || hearing.appPhase === "Notification" || /review|pending/i.test(hearing.appStatus)) return "Under review";
  return "Submitted";
}
