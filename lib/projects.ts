import{areaPath,FEATURED_AREA_ID,getArea}from"./areas/registry";
import type { HearingFeed } from "@/lib/localities/types";

export const PUBLIC_COMMENT_URL = "https://www.cityofnampa.us/1616/Public-Comment";
export const HEARINGS_URL = "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings";
export const PROJECT_STAGES = ["Submitted", "Under review", "P&Z hearing", "Council hearing", "Decided"] as const;
export type ProjectStage = typeof PROJECT_STAGES[number];
export type ProjectHearing = {
  agendaUrl?: string;
  packetUrl?: string;
  startsAt: string;
  body: string;
  location: string;
  sourceUrl: string;
  commentDeadline?: string;
  commentSourceUrl?: string;
};
export type Project = {
  areaId?:string;
  name?: string;
  slug: string;
  title: string;
  location: string;
  summary: string;
  caseIds: string[];
  cases: { id: string; label: string; portalUrl: string }[];
  image: string;
  sourceDocuments?: { caseIds: string[]; label: string; url: string; sourceUrl: string; fileNames?: string[] }[];
  pastHearings?: { date: string; body: string; sourceUrl: string; isHearing: boolean }[];
  nextHearing?: ProjectHearing;
};

export const braeburnCreek: Project = {
  name: "Braeburn Creek",
  slug: "braeburn-creek",
  title: "Braeburn Creek: proposed homes at Amity & Happy Valley",
  location: "Northeast corner of E. Amity Ave & S. Happy Valley Rd, Nampa",
  summary: "The source aerial map shows largely agricultural land at Amity & Happy Valley. Toll Brothers’ September application proposes 487 detached homes on about 138 acres; the March neighborhood notice described roughly 500 homes on 137 acres. The applications request annexation and zoning plus a preliminary subdivision plat.",
  caseIds: ["ANN-00371-2026", "SPP-00184-2026"],
  cases: [
    { id: "ANN-00371-2026", label: "Annexation and zoning", portalUrl: "https://nampaid-energovpub.tylerhost.net/Apps/SelfService#/plan/885c7660-323f-4486-9d09-75d47c42968f" },
    { id: "SPP-00184-2026", label: "Preliminary plat", portalUrl: "https://nampaid-energovpub.tylerhost.net/Apps/SelfService#/plan/c453892b-7335-4195-8113-a3a19524dbf5" },
  ],
  image: "/us/id/nampa/toll-brothers-site-map.webp",
  sourceDocuments: [
    { label: "ANN-00371-2026_Braeburn Creek_Decision Letter PZ.pdf", url: "https://nampaid-energovpub.tylerhost.net/Apps/SelfService#/plan/885c7660-323f-4486-9d09-75d47c42968f?tab=attachments", sourceUrl: "https://nampaid-energovpub.tylerhost.net/Apps/SelfService#/plan/885c7660-323f-4486-9d09-75d47c42968f?tab=attachments", caseIds: ["ANN-00371-2026"] },

    {
      caseIds: ["ANN-00371-2026", "SPP-00184-2026"],
      label: "Agenda — P&Z hearing, September 29, 2026",
      url: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062#AgendaItem_35512",
      sourceUrl: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062",
    },
    {
      caseIds: ["ANN-00371-2026", "SPP-00184-2026"],
      label: "Staff report — P&Z hearing, September 29, 2026 (shared project report)",
      fileNames: ["ANN-00371-2026_Braeburn Creek_Staff Report PZ_Sept2026.pdf"],
      url: "https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=acf18754-7101-48d9-b4ea-f8398342a0fa",
      sourceUrl: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062#AgendaItem_35512",
    },
  ],
  pastHearings: [{ date: "2026-09-29", body: "Planning & Zoning", sourceUrl: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062#AgendaItem_35512", isHearing: true }],
  nextHearing: {
    startsAt: "2026-11-02T18:00:00-07:00",
    body: "City Council",
    location: "Nampa City Hall, Council Chambers, 411 3rd St S, Nampa, ID",
    sourceUrl: HEARINGS_URL,
    commentDeadline: "2026-11-02T12:00:00-07:00",
    commentSourceUrl: PUBLIC_COMMENT_URL,
  },
};

export const projects: Project[] = [braeburnCreek];
export function getProjectForCase(caseId: string,areaId=FEATURED_AREA_ID): Project | undefined {
  return projects.find((p) => (p.areaId??FEATURED_AREA_ID)===areaId&&p.caseIds.includes(caseId.toUpperCase()));
}
export function projectPathForCase(caseId: string, areaId=FEATURED_AREA_ID): string {
  const project = getProjectForCase(caseId, areaId);
  return project ? "/" + project.slug : "/plan/" + encodeURIComponent(caseId);
}
export function projectHearings(project: Project, feed?: HearingFeed) {
  return [...(feed?.active ?? []), ...(feed?.completed ?? []), ...(feed?.upcomingOnly ?? [])]
    .filter((h) => project.caseIds.includes(h.appId.toUpperCase()));
}

export function getProjectNextHearing(project: Project, feed?: HearingFeed, now = new Date()): ProjectHearing | undefined {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const hearings = projectHearings(project, feed);
  const scheduled = hearings.flatMap((h) => h.meetings)
    .filter((m) => !m.continuedNote && m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const known = project.nextHearing && new Date(project.nextHearing.startsAt) >= now ? project.nextHearing : undefined;
  if (scheduled) {
    // The verified project notice supplies the hearing time (Council business
    // can start before public hearings). Never substitute a meeting's start time.
    if (known && known.startsAt.slice(0, 10) === scheduled.date && known.body === scheduled.body) return { ...known, agendaUrl: scheduled.agendaUrl, packetUrl: scheduled.packetUrl };
    return {
      startsAt: scheduled.date,
      body: scheduled.bodyLabel,
      location: "Nampa City Hall, Council Chambers, 411 3rd St S, Nampa, ID",
      sourceUrl: scheduled.sourceUrl,
    };
  }
  const explicitlyContinued = known && hearings.some((h) => h.meetings.some((m) => m.date === known.startsAt.slice(0, 10) && m.continuedNote));
  const allCompleted = project.caseIds.every((id) => feed?.completed.some((h) => h.appId === id));
  return explicitlyContinued || allCompleted ? undefined : known;
}

export function getProjectStage(project: Project, feed?: HearingFeed, now = new Date()): ProjectStage {
  const next = getProjectNextHearing(project, feed, now);
  if (next) return /council/i.test(next.body) ? "Council hearing" : "P&Z hearing";
  const hearings = projectHearings(project, feed);
  if (hearings.length && project.caseIds.every((id) => feed?.completed.some((h) => h.appId === id))) return "Decided";
  const active = hearings.filter((h) => !h.decisionRecorded);
  if (active.some((h) => h.appPhase === "City Council")) return "Council hearing";
  if (active.some((h) => h.appPhase === "PZ Commission")) return "P&Z hearing";
  return active.length ? "Under review" : "Submitted";
}

export function formatDenverDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", weekday: "long", month: "long", day: "numeric", year: "numeric" })
    .format(new Date(value.length === 10 ? value + "T12:00:00-07:00" : value));
}
export function formatDenverTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

/** RFC 5545 calendar event in UTC; offsets on source dates account for DST. */
export function hearingCalendar(project: Pick<Project, "slug" | "title"> & { path?: string; areaId?:string }, hearing: ProjectHearing): string | undefined {
  if (hearing.startsAt.length === 10) return undefined; // Time not confirmed.
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Local Agenda Watch//Public hearings//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    "UID:" + project.slug + "-" + hearing.startsAt.slice(0, 10) + "@localagendawatch.com",
    "DTSTAMP:" + utc(new Date()), "DTSTART:" + utc(new Date(hearing.startsAt)),
    "SUMMARY:" + escape(project.title + " — " + hearing.body + " hearing"), "LOCATION:" + escape(hearing.location),
    "DESCRIPTION:" + escape("Public hearing start time; individual items may be heard later. Confirm details with the published agenda. " + (getArea(project.areaId??FEATURED_AREA_ID)?.commentInstructionsUrl??hearing.sourceUrl)),
    "URL:https://www.localagendawatch.com"+areaPath(project.areaId??FEATURED_AREA_ID)+"/" + (project.path ?? project.slug), "END:VEVENT", "END:VCALENDAR"];
  // Fold by UTF-8 octets, not JS characters, to preserve Unicode titles.
  return lines.map((line) => {
    let result = "", segment = "";
    for (const ch of line) {
      if (Buffer.byteLength(segment + ch, "utf8") > 75) { result += segment + "\r\n"; segment = " "; }
      segment += ch;
    }
    return result + segment;
  }).join("\r\n") + "\r\n";
}
