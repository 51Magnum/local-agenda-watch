import { load } from "cheerio";
import type { AgendaItem, AgendaMeeting } from "@/lib/localities/types";

export const NAMPA_PRIMEGOV_ORIGIN = "https://nampa.primegov.com";
export const NAMPA_PRIMEGOV_MEETINGS_URL = NAMPA_PRIMEGOV_ORIGIN + "/api/v2/PublicPortal/ListUpcomingMeetings";

// IDs from the public portal's GetCommitteeesListByShowInPublicPortal endpoint.
const COMMITTEES: Record<number, { body: string; bodyLabel: string }> = {
  1: { body: "City Council", bodyLabel: "City Council" },
  15: { body: "P&Z", bodyLabel: "Planning & Zoning Commission" },
  4: { body: "Arts & Historic Preservation", bodyLabel: "Arts & Historic Preservation Commission" },
};

type PrimeGovDocument = {
  id: number;
  templateId: number;
  templateName: string;
  compileOutputType: number;
  link: string | null;
};

function publicUrl(href: string): string | undefined {
  try {
    const url = new URL(href, NAMPA_PRIMEGOV_ORIGIN);
    return url.protocol === "https:" && url.origin === NAMPA_PRIMEGOV_ORIGIN ? url.href : undefined;
  } catch { return undefined; }
}

function documentUrl(doc: PrimeGovDocument): string | undefined {
  if (doc.link) return publicUrl(doc.link);
  const param = doc.templateId > 0 ? "meetingTemplateId=" + doc.templateId : "compiledMeetingDocumentFileId=" + doc.id;
  return NAMPA_PRIMEGOV_ORIGIN + (doc.compileOutputType === 3
    ? "/Portal/Meeting?" + param
    : "/Public/CompiledDocument?" + param + "&compileOutputType=" + doc.compileOutputType);
}

export function parsePrimeGovMeetings(payload: unknown): AgendaMeeting[] {
  if (!Array.isArray(payload)) throw new Error("Invalid PrimeGov meetings response");
  return payload.flatMap((row) => {
    if (!row || typeof row !== "object") throw new Error("Invalid PrimeGov meeting");
    const committee = COMMITTEES[row.committeeId];
    if (!committee) return [];
    if (!Number.isInteger(row.id) || typeof row.title !== "string" ||
        typeof row.dateTime !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(row.dateTime)) {
      throw new Error("Invalid PrimeGov meeting fields");
    }
    const docs: PrimeGovDocument[] = Array.isArray(row.documentList) ? row.documentList : [];
    const html = docs.find((d) => d.compileOutputType === 3 && /agenda/i.test(d.templateName));
    const agenda = html ?? docs.find((d) => /agenda/i.test(d.templateName));
    const minutes = docs.find((d) => /minutes/i.test(d.templateName) && d.compileOutputType === 1) ?? docs.find((d) => /minutes/i.test(d.templateName));
    const packet = docs.find((d) => /packet/i.test(d.templateName));
    const date = row.dateTime.slice(0, 10); // PrimeGov publishes Nampa wall time without an offset.
    return [{
      id: String(row.id),
      ...committee,
      title: row.title,
      date,
      dateLabel: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date(date + "T12:00:00Z")),
      localStartTime: row.dateTime.slice(11, 16),
      timeLabel: typeof row.time === "string" ? row.time : undefined,
      location: typeof row.location === "string" ? row.location : undefined,
      sourceUrl: NAMPA_PRIMEGOV_ORIGIN + "/public/portal",
      agendaUrl: agenda && documentUrl(agenda),
      htmlAgendaUrl: html && documentUrl(html),
      packetUrl: packet && documentUrl(packet),
      minutesUrl: minutes && documentUrl(minutes),
      videoUrl: recordingUrl(row.videoUrl),
      items: [],
    }];
  });
}

/** Match only the item's visible description, not IDs mentioned in attachments. */
export function parsePrimeGovAgenda(html: string, agendaUrl: string): AgendaItem[] {
  const $ = load(html);
  if (/Document Not Found|Just a moment|Attention Required/i.test($("title").text())) {
    throw new Error("PrimeGov agenda unavailable");
  }
  if (!$(".agenda-item").length) throw new Error("PrimeGov agenda item markup missing");
  const items: AgendaItem[] = [];
  $(".agenda-item").each((_i, element) => {
    const item = $(element);
    const description = item.clone();
    description.find(".item_contents, .attachment-holder, script, style").remove();
    const title = description.text().replace(/\s+/g, " ").trim();
    const caseIds = [...new Set((title.match(/\b[A-Z]{2,6}-\d{5}-\d{4}\b/gi) ?? []).map((id) => id.toUpperCase()))];
    if (!caseIds.length) return;
    const staffReports: AgendaItem["staffReports"] = [];
    item.find(".attachment-holder").each((_j, holder) => {
      const links = $(holder).find("a[href]").toArray();
      const report = links.find((a) => /staff[\s_-]*report/i.test($(a).text() + " " + ($(a).attr("title") ?? "")) &&
        /historyattachment|download/i.test($(a).attr("href") ?? "")) ??
        links.find((a) => /staff[\s_-]*report/i.test($(a).text() + " " + ($(a).attr("title") ?? "")));
      if (!report) return;
      const url = publicUrl($(report).attr("href")!);
      const label = ($(report).text().trim() || $(report).attr("title") || "Staff report").replace(/\s+/g, " ");
      if (url && !staffReports.some((r) => r.url === url)) staffReports.push({ label, url });
    });
    const anchor = item.attr("id");
    items.push({ title, caseIds, agendaUrl: anchor ? agendaUrl + "#" + encodeURIComponent(anchor) : agendaUrl, staffReports });
  });
  return items;
}

export async function getNampaPrimeGovMeetings(options: { revalidate?: number } = {}): Promise<AgendaMeeting[]> {
  const request = async (url: string) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json,text/html;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: options.revalidate ?? 1800, tags: ["nampa:primegov"] },
    });
    if (!response.ok) throw new Error("PrimeGov HTTP " + response.status + " on " + url);
    return response;
  };
  try {
    const meetings = parsePrimeGovMeetings(await (await request(NAMPA_PRIMEGOV_MEETINGS_URL)).json());
    return await Promise.all(meetings.map(async (meeting) => {
      if (!meeting.htmlAgendaUrl) return meeting;
      try {
        const html = await (await request(meeting.htmlAgendaUrl)).text();
        return { ...meeting, items: parsePrimeGovAgenda(html, meeting.htmlAgendaUrl) };
      } catch (err) {
        console.error("[nampa:primegov] Agenda failed for meeting " + meeting.id, err);
        return meeting;
      }
    }));
  } catch (err) {
    console.error("[nampa:primegov] Upcoming meetings failed", err);
    return [];
  }
}


function recordingUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : undefined; }
  catch { return undefined; }
}

/** Archive failures are explicit; a missing agenda must not mean a case never appeared. */
export async function getNampaMeetingArchive(year: number, filter: { caseId?: string; body?: string } = {}) {
  const request = async (url: string) => {
    const response = await fetch(url, { headers: { Accept: "application/json,text/html" },
      signal: AbortSignal.timeout(15000), next: { revalidate: 3600, tags: ["nampa:archive"] } });
    if (!response.ok) throw new Error("PrimeGov archive HTTP " + response.status);
    return response;
  };
  try {
    let meetings = parsePrimeGovMeetings(await (await request(NAMPA_PRIMEGOV_ORIGIN + "/api/v2/PublicPortal/ListArchivedMeetings?year=" + year)).json());
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    meetings = meetings.filter((m) => m.date <= today && (!filter.body || m.body === filter.body) && !/attendance|state of the city/i.test(m.title));
    let unsearched = 0;
    if (filter.caseId) {
      const matched: AgendaMeeting[] = [];
      // Bound concurrency, while caching each official agenda across case searches.
      for (let i = 0; i < meetings.length; i += 6) {
        await Promise.all(meetings.slice(i, i + 6).map(async (meeting) => {
          if (!meeting.htmlAgendaUrl) { unsearched++; return; }
          try {
            const items = parsePrimeGovAgenda(await (await request(meeting.htmlAgendaUrl)).text(), meeting.htmlAgendaUrl)
              .filter((item) => item.caseIds.includes(filter.caseId!.toUpperCase()));
            if (items.length) matched.push({ ...meeting, items });
          } catch (err) {
            unsearched++;
            console.error("[nampa:archive] Agenda unavailable: " + meeting.id, err);
          }
        }));
      }
      meetings = matched;
    }
    return { meetings: meetings.sort((a, b) => b.date.localeCompare(a.date)), unavailable: false, unsearched };
  } catch (err) {
    console.error("[nampa:archive] Archive unavailable", err);
    return { meetings: [], unavailable: true, unsearched: 0 };
  }
}
