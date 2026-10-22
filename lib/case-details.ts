import { CASE_EVIDENCE } from "@/lib/case-evidence";
import { getCaseStage } from "@/lib/localities/stages";
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
  if (getCaseStage(hearing, false, now) === "Decided") return undefined;
  const project = getProjectForCase(hearing.appId);
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
    const name = tail.split(/_(?:Application|Staff[ _-]*Report|Narrative|Site[ _-]*Plan|Decision|Prelim)/i)[0]
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
  const files = [...attachments.filter((a) => !a.IsFileSecure).map((a) => a.FileName), ...(evidence?.documentNames ?? [])];
  const name = plan?.ProjectName?.trim() || projectNameFromFiles(hearing.appId, files);
  const address = plan?.MainAddress ? clean(plan.MainAddress) : evidence?.address ?? description.match(/\bat\s+(.+?)(?:\.\s*Original Concept:|\s*\(|$)/i)?.[1];
  const type = cleanCaseType(plan?.PlanType || hearing.appTypeLabel).toLowerCase();
  const acres = hearing.appAcres != null ? " of " + hearing.appAcres.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " acres" : "";
  const zoning = [hearing.appScope, description, plan?.Description].filter(Boolean).join(" ").match(/\bto\s+(IL|IH|RA|RS\d+|RML|RMH|BC|GB\d?)\b/i)?.[1]?.toUpperCase();
  const zoneLabel = zoning === "IL" ? "IL (light industrial)" : zoning;
  return (name ? clean(name) + ": " : "") + type + acres + (address ? " at " + clean(address) : "") + (zoneLabel ? " to " + zoneLabel : "") + ".";
}

export function uniqueAttachments(attachments: EnerGovAttachment[]): EnerGovAttachment[] {
  return [...new Map(attachments.filter((a) => !a.IsFileSecure).map((a) => [a.FileName.trim().toLowerCase().replace(/\s+/g, " "), a])).values()];
}

export function uniqueDocumentLinks<T extends { label: string; url: string }>(documents: T[]): T[] {
  const seen = new Set<string>();
  return documents.filter((doc) => {
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
