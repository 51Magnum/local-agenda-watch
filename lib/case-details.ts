import{FEATURED_AREA_ID}from"./areas/registry";
import{displayArea}from"./areas/format";
import { CASE_EVIDENCE } from "@/lib/case-evidence";
import { getCaseStage, getCaseStatus } from "@/lib/localities/stages";
import type { Hearing, HearingFeed } from "@/lib/localities/types";
import type { EnerGovAttachment, EnerGovPlan } from "@/lib/sources/energov";
import { getProjectForCase, getProjectNextHearing, type ProjectHearing } from "@/lib/projects";

export const PENDING_AGENDA_MESSAGE = "Agenda usually posted the Thursday before the meeting";
export const NAMPA_HEARING_LOCATION = "Nampa City Hall, Council Chambers, 411 3rd St S, Nampa, ID";

/** Convert Nampa wall time using its IANA zone, including daylight-saving time. */
export function denverInstant(date: string, time: string,timezone=displayArea().timezone): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, h, min);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    instant += target - wall;
  }
  return new Date(instant).toISOString();
}

export function getCaseNextHearing(hearing: Hearing, feed?: HearingFeed, now = new Date(),areaId=FEATURED_AREA_ID): ProjectHearing | undefined {
  const area=displayArea(areaId);
  if (getCaseStage(hearing, false, now) === "Decided") return undefined;
  const project = getProjectForCase(hearing.appId,areaId);
  if (project) {
    const curated = getProjectNextHearing(project, feed ?? { active: [hearing], completed: [] }, now);
    if (curated) return curated;
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const councilStage = getCaseStage(hearing, false, now) === "Council hearing";
  const next = hearing.meetings.filter((m) => !m.continuedNote && m.date >= today && (!councilStage || m.body === "City Council"))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return undefined;
  const agendaMeeting = feed?.agendaMeetings?.find((m) => m.body === next.body && m.date === next.date);
  const council = next.body === area.bodies.decision.id;
  // Nampa's published hearing schedule specifies 6 p.m. for Council and P&Z.
  // Use an explicitly published hearing time before a general meeting's start.
  const isCityHearing = !!area.sources.hearingsSchedule&&next.sourceUrl.startsWith(area.sources.hearingsSchedule);
  const time = next.time ?? (isCityHearing ? area.meetingRules.defaultHearingTime : agendaMeeting?.localStartTime);
  return {
    startsAt: time ? denverInstant(next.date, time,area.timezone) : next.date,
    body: next.bodyLabel,
    location: next.location || agendaMeeting?.location || (area.meetingRules.location??"Location not confirmed — check the official agenda."),
    sourceUrl: next.sourceUrl,
    agendaUrl: next.agendaUrl ?? agendaMeeting?.agendaUrl,
    packetUrl: next.packetUrl ?? agendaMeeting?.packetUrl,
    ...(council&&area.meetingRules.decisionCommentDeadlineHour!=null ? { commentDeadline: denverInstant(next.date, String(area.meetingRules.decisionCommentDeadlineHour).padStart(2,"0")+":00",area.timezone), commentSourceUrl: area.commentInstructionsUrl } : {}),
  };
}

export function displayTitle(value: string): string {
  const replacements: Record<string, string> = { varience: "variance", varianace: "variance", annexaation: "annexation", annaxation: "annexation", zoniong: "zoning", communit: "community" };
  return value.replace(/\b(varience|varianace|annexaation|annaxation|zoniong|communit)\b/gi, (word) => {
    const fixed = replacements[word.toLowerCase()];
    return /^[A-Z]/.test(word) ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
  }).replace(/\s+/g, " ").trim();
}

export function cleanCaseType(value: string): string {
  return displayTitle(value).replace(/\s*\((?:more|less|greater|up to|over|under)[^)]*acres?[^)]*\)/gi, "").trim();
}

export function projectNameFromFiles(caseId: string, filenames: string[]): string | undefined {
  const id = caseId.toUpperCase();
  for (const filename of filenames) {
    const index = filename.toUpperCase().indexOf(id + "_");
    if (index < 0) continue;
    const tail = filename.slice(index + id.length + 1);
    const name = tail.split(/_(?:Application|Staff[ _-]*Report|Narrative|Site[ _-]*Plan|Decision|Prelim|Ordinance|Recorded|Notice|Neighborhood|Legal|Exhibit|Findings)/i)[0]
      .replace(/\.(pdf|docx?)$/i, "").replace(/_/g, " ").trim();
    if (name && !/^(application|staff report|narrative|site plan|decision)/i.test(name) && !/\b[A-Z]{2,6}-\d{5}-\d{4}\b/.test(name)) return name;
  }
}

/** Names come only from a record's ProjectName or a matching document filename. */
export function caseSummary(hearing: Hearing, plan: EnerGovPlan | null, attachments: EnerGovAttachment[] = []): string {
  const curated = getProjectForCase(hearing.appId);
  if (curated) return curated.summary;
  const evidence = CASE_EVIDENCE[hearing.appId];
  const description = hearing.description ?? "";
  const clean = (s: string) => s.replace(/\r?\n/g, ", ").replace(/\s+/g, " ").trim().replace(/[.,\s]+$/, "");
  const files = [...uniqueAttachments(attachments).map((a) => a.FileName), ...(evidence?.documentNames ?? [])];
  const name = caseProjectName(hearing, plan, files);
  const address = plan?.MainAddress ? clean(plan.MainAddress) : evidence?.address ?? description.match(/\bat\s+(.+?)(?:\.\s*Original Concept:|\s*\(|$)/i)?.[1];
  const type = cleanCaseType(plan?.PlanType || hearing.appTypeLabel).toLowerCase();
  const acres = hearing.appAcres != null ? " of " + hearing.appAcres.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " acres" : "";
  const zoning = [hearing.appScope, description, plan?.Description].filter(Boolean).join(" ").match(/\bto\s+(IL|IH|RA|RS\d+|RML|RMH|BC|GB\d?)\b/i)?.[1]?.toUpperCase();
  const zoneLabel = zoning === "IL" ? "IL (light industrial)" : zoning;
  return (name ? clean(name) + ": " : "") + type + acres + (address ? " at " + clean(address) : "") + (zoneLabel ? " to " + zoneLabel : "") + ".";
}

export function uniqueAttachments(attachments: EnerGovAttachment[]): EnerGovAttachment[] {
  return [...new Map(attachments.filter((a) => !a.IsFileSecure && !isPrivateDocument(a.FileName + " " + (a.Notes ?? ""))).map((a) => [a.FileName.trim().toLowerCase().replace(/\s+/g, " "), a])).values()];
}

export function uniqueDocumentLinks<T extends { label: string; url: string }>(documents: T[]): T[] {
  const seen = new Set<string>();
  return documents.filter((doc) => {
    if (isPrivateDocument(doc.label)) return false;
    const url = new URL(doc.url, "https://www.localagendawatch.com");
    const history = url.searchParams.get("historyId") ?? url.searchParams.get("uid");
    const key = history ?? (url.hash.includes("/plan/") ? doc.label.toLowerCase().replace(/[^a-z0-9]/g, "") : url.href);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function staffReportLinks(hearing: Hearing, attachments: EnerGovAttachment[], attachmentsUrl: string) {
  const fromAgenda = hearing.meetings.flatMap((m) => m.staffReports ?? []);
  const evidence = CASE_EVIDENCE[hearing.appId];
  if (evidence?.reportUrl) fromAgenda.push({ label: evidence.documentNames[0], url: evidence.reportUrl });
  const fromProject = (getProjectForCase(hearing.appId)?.sourceDocuments ?? [])
    .filter((d) => d.caseIds.includes(hearing.appId) && /staff[\s_-]*report/i.test(d.label))
    .map((d) => ({ label: d.label, url: d.url }));
  const fromFile = uniqueAttachments(attachments).filter((a) => !a.IsFileSecure && /staff[\s_-]*report/i.test((a.Notes ?? "") + " " + a.FileName))
    .map((a) => ({ label: a.Notes || a.FileName, url: attachmentsUrl }));
  return uniqueDocumentLinks([...fromAgenda, ...fromProject, ...fromFile]);
}

/** City-published names/topics, retained when a portal request is unavailable. */
const CITY_CASE_NAMES: Record<string, string> = {
  "ANN-00358-2026": "Lonestar", "MPC-00006-2026": "Lonestar",
  "ANN-00367-2026": "Emberwood", "SPP-00182-2026": "Emberwood",
  "ANN-00339-2025": "District Sixteen", "ANN-00370-2026": "Resting Rock",
  "ANN-00361-2026": "Whitewater", "MPC-00007-2026": "Whitewater",
  "CTA-00026-2026": "SH16 Specific Area Plan", "CMA-00074-2026": "SH16 future land-use map",
  "ZTA-00050-2026": "Group homes and GB district",
  "SPP-00124-2023": "Wilson Landing", "SPF-00294-2025": "Silverland Park",
  // City notice: https://www.cityofnampa.us/AgendaCenter/ViewFile/Agenda/_04282026-3417
  "CMA-00067-2026": "Elite Industrial", "ANN-00352-2026": "Elite Industrial", "SPP-00175-2026": "Elite Industrial",
};
const SHORT_TYPES: Record<string, string> = {
  ANN: "annexation", MPC: "master plan", SPP: "preliminary plat", SPF: "final plat",
  CTA: "comprehensive plan text amendment", CMA: "comprehensive plan map amendment",
  ZTA: "zoning text amendment", ZMA: "rezone", CUP: "conditional use permit",
};
function safeName(value: string | null | undefined): string | undefined {
  const name = value && displayTitle(value).replace(/\s+(?:subdivision|ordinance recorded.*)$/i, "").trim();
  return name && name.length <= 90 && !/\.(pdf|docx?)\b|Original Concept:|[\r\n_]|[A-Z]{2,6}-\d{5}-\d{4}|^(?:staff report|application|decision letter)$/i.test(name) ? name : undefined;
}
export function caseProjectName(hearing: Hearing, plan: EnerGovPlan | null = null, filenames: string[] = []): string | undefined {
  if (hearing.appId === "ANN-00369-2026") return "Northside Logistics Center";
  return getProjectForCase(hearing.appId)?.name ?? CITY_CASE_NAMES[hearing.appId] ?? safeName(plan?.ProjectName) ?? safeName(projectNameFromFiles(hearing.appId, filenames));
}
export function caseDisplayTitle(hearing: Hearing, plan: EnerGovPlan | null = null, attachments: EnerGovAttachment[] = []): string {
  const name = caseProjectName(hearing, plan, uniqueAttachments(attachments).map((a) => a.FileName)) ?? nameFromCityRecord(hearing);
  const type = ["ANN-00358-2026", "MPC-00006-2026"].includes(hearing.appId) ? "annexation and master plan" : SHORT_TYPES[hearing.appType] ?? cleanCaseType(hearing.appTypeLabel).toLowerCase();
  return name ? name + " " + type : displayTitle(type || "Planning case").replace(/^./, (c) => c.toUpperCase()) + " (" + hearing.appId + ")";
}
export function caseMetaDescription(hearing: Hearing, title: string, next?: ProjectHearing): string {
  return title + ". " + getCaseStatus(hearing) + ". " + (next ? "Next hearing: " + next.body + ", " + new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", dateStyle: "long" }).format(new Date(next.startsAt.length === 10 ? next.startsAt + "T12:00:00Z" : next.startsAt)) + "." : getCaseStage(hearing) === "Council hearing" ? "Council date not set." : getCaseStage(hearing) === "Decided" ? "View the official documents and hearing record." : "No hearing scheduled yet.");
}
/** Resident attendance sheets are accessible at the city, but omitted here. */
export function isPrivateDocument(label: string): boolean {
  return /\bsign[\s_-]*in\b|\bsignin\b|attendance[\s_-]*(?:sheet|list|roster)|\bsign[\s_-]*up[\s_-]*sheet\b/i.test(label.replace(/_/g, " "));
}

function nameFromCityRecord(hearing: Hearing): string | undefined {
  // Explicit project-name clauses in the city record, never prose as a heading.
  const text = hearing.description ?? hearing.appScope ?? "";
  const named = text.match(/\bfor\s+([^.;()]+?)\s+(?:at|in a|on (?:two |three )?parcels?)\b/i)?.[1];
  if (named && !/\b(?:Title|Chapter|representing|LLC)\b/i.test(named)) return safeName(named);
  if (hearing.appScope && !/\b(?:annexation|rezone|amendment|variance|plat|permit|approval|extension|for)\b|\.(?:pdf|docx?)\b/i.test(hearing.appScope)) return safeName(hearing.appScope);
}
