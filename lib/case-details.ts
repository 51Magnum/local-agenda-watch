import type { Hearing, HearingFeed } from "@/lib/localities/types";
import type { EnerGovAttachment, EnerGovPlan } from "@/lib/sources/energov";
import { getProjectForCase, getProjectNextHearing, PUBLIC_COMMENT_URL, type ProjectHearing } from "@/lib/projects";

export const PENDING_AGENDA_MESSAGE = "Agenda usually posted the Thursday before the meeting";
export const NAMPA_HEARING_LOCATION = "Nampa City Hall, Council Chambers, 411 3rd St S, Nampa, ID";

/** Convert Nampa wall time using its IANA zone, including daylight-saving time. */
export function denverInstant(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, h, min);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    instant += target - wall;
  }
  return new Date(instant).toISOString();
}

export function getCaseNextHearing(hearing: Hearing, feed?: HearingFeed, now = new Date()): ProjectHearing | undefined {
  if (hearing.decisionRecorded) return undefined;
  const project = getProjectForCase(hearing.appId);
  if (project) {
    const curated = getProjectNextHearing(project, feed ?? { active: [hearing], completed: [] }, now);
    if (curated) return curated;
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const next = hearing.meetings.filter((m) => !m.continuedNote && m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return undefined;
  const agendaMeeting = feed?.agendaMeetings?.find((m) => m.body === next.body && m.date === next.date);
  const council = next.body === "City Council";
  // Nampa's published hearing schedule specifies 6 p.m. for Council and P&Z.
  // Use an explicitly published hearing time before a general meeting's start.
  const isCityHearing = next.sourceUrl.includes("cityofnampa.us/1433/");
  const time = next.time ?? (isCityHearing && (council || next.body === "P&Z") ? "18:00" : agendaMeeting?.localStartTime);
  return {
    startsAt: time ? denverInstant(next.date, time) : next.date,
    body: next.bodyLabel,
    location: next.location || agendaMeeting?.location || (council || next.body === "P&Z" ? NAMPA_HEARING_LOCATION : "Location not confirmed — check the official agenda."),
    sourceUrl: next.sourceUrl,
    agendaUrl: next.agendaUrl ?? agendaMeeting?.agendaUrl,
    packetUrl: next.packetUrl ?? agendaMeeting?.packetUrl,
    ...(council ? { commentDeadline: denverInstant(next.date, "12:00"), commentSourceUrl: PUBLIC_COMMENT_URL } : {}),
  };
}

/** Use only supplied fields; missing names, acreage and addresses stay omitted. */
export function caseSummary(hearing: Hearing, plan: EnerGovPlan | null): string {
  const curated = getProjectForCase(hearing.appId);
  if (curated) return curated.summary;
  const description = hearing.description ?? "";
  const clean = (s: string) => s.replace(/\r?\n/g, ", ").replace(/\s+/g, " ").trim().replace(/[.,\s]+$/, "");
  const nameFromNotice = description.match(/\bfor\s+(.+?)\s+(?:at|on|addressed as)\b/i)?.[1];
  const name = plan?.ProjectName?.trim() || nameFromNotice || hearing.appScope?.trim();
  const address = plan?.MainAddress ? clean(plan.MainAddress) : description.match(/\bat\s+(.+?)(?:\.\s*Original Concept:|\s*\(|$)/i)?.[1];
  const type = (plan?.PlanType || hearing.appTypeLabel).toLowerCase();
  const acres = hearing.appAcres != null ? " of " + hearing.appAcres.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " acres" : "";
  const zoning = [hearing.appScope, description, plan?.Description].filter(Boolean).join(" ").match(/\bto\s+(IL|IH|RA|RS\d+|RML|RMH|BC|GB\d?)\b/i)?.[1]?.toUpperCase();
  const zoneLabel = zoning === "IL" ? "IL (light industrial)" : zoning;
  return (name ? clean(name) + ": " : "") + type + acres + (address ? " at " + clean(address) : "") + (zoneLabel ? " to " + zoneLabel : "") + ".";
}

export function staffReportLinks(hearing: Hearing, attachments: EnerGovAttachment[], attachmentsUrl: string) {
  const fromAgenda = hearing.meetings.flatMap((m) => m.staffReports ?? []);
  const fromProject = (getProjectForCase(hearing.appId)?.sourceDocuments ?? [])
    .filter((d) => d.caseIds.includes(hearing.appId) && /staff[\s_-]*report/i.test(d.label))
    .map((d) => ({ label: d.label, url: d.url }));
  const fromFile = attachments.filter((a) => !a.IsFileSecure && /staff[\s_-]*report/i.test((a.Notes ?? "") + " " + a.FileName))
    .map((a) => ({ label: a.Notes || a.FileName, url: attachmentsUrl }));
  return [...new Map([...fromAgenda, ...fromProject, ...fromFile].map((r) => [r.label + r.url, r])).values()];
}
