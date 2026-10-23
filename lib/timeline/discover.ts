import { load } from "cheerio";
import { getNampaHearings } from "@/lib/localities/nampa";
import { getLocality } from "@/lib/localities";
import { projects } from "@/lib/projects";
import type { HearingFeed } from "@/lib/localities/types";
import { NAMPA_PRIMEGOV_ORIGIN, parsePrimeGovMeetings, parsePrimeGovAgenda } from "@/lib/sources/primegov";
import { extractNativePdfPages, ocrMissingPages } from "./extract";
import type { EvidenceStore } from "./store";
import { emptyEvidenceState, publicFields, type PageText } from "./types";
import { digest, downloadDocument, officialDocumentUrl } from "./ingest";
import type { DocumentKind, FieldKey, SourceDocument } from "./types";

export function documentKind(title: string): DocumentKind {
  if (/staff[\s_-]*report/i.test(title)) return "staff-report";
  if (/minutes/i.test(title)) return "minutes";
  if (/reasoned|findings/i.test(title)) return "findings";
  if (/decision|determination|action[\s_-]*letter/i.test(title)) return /P[&Z\s._-]*Z|planning.*zoning/i.test(title) ? "pz-decision" : /council|CC[\s_-]/i.test(title) ? "council-decision" : "findings";
  return "other";
}
function dateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const legacy = /\/Date\((\d+)(?:[+-]\d+)?\)\//.exec(value);
  if (legacy) return new Date(Number(legacy[1])).toISOString().slice(0, 10);
  return undefined;
}
async function officialRequest(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000), headers: { Accept: "application/json,text/html", "User-Agent": "Mozilla/5.0 LocalAgendaWatch/1.0" } });
  if (!response.ok) throw new Error("City source HTTP " + response.status);
  return response;
}
export async function discoverCaseDocuments(options: { caseIds?: string[]; budgetMs?: number; store?: EvidenceStore; deadline?: number } = {}) {
  const deadline = options.deadline ?? Date.now() + (options.budgetMs ?? 120000);
  const locality = getLocality("nampa")!;
  const cached = options.store ? await options.store.read() : emptyEvidenceState();
  const extractedPages = new Map<string, PageText[]>();
  const warnings: string[] = [];
  const feed: HearingFeed | undefined = await getNampaHearings().catch((error: unknown) => { warnings.push("Case feed unavailable: " + String(error)); return undefined; });
  const configured = process.env.TIMELINE_CASE_IDS ?? "ANN-00371-2026,SPP-00184-2026";
  const unresolved = [...new Set(Object.values(cached.documents).flatMap((document) => document.caseIds))].filter((caseId) => !publicFields(cached, [caseId]).some((field) => field.key === "councilDecision" && field.status === "approved" && ["approved", "denied", "withdrawn"].includes(field.value)));
  const caseIds = options.caseIds ?? (configured === "*" ? [...new Set([...([... (feed?.active ?? []), ...(feed?.upcomingOnly ?? [])].map((h) => h.appId)), ...unresolved]) ] : configured.split(",").map((id) => id.trim().toUpperCase()).filter((id) => /^[A-Z]{2,6}-\d{5}-\d{4}$/.test(id)));
  const documents: SourceDocument[] = [];
  const offset = Math.max(0, caseIds.indexOf(cached.cursor ?? ""));
  const orderedCases = [...caseIds.slice(offset), ...caseIds.slice(0, offset)];
  let lastCase: string | undefined;
  for (const caseId of orderedCases) {
    if (Date.now() > deadline) { warnings.push("Case discovery time limit reached; remaining cases resume next run."); break; }
    lastCase = caseId;
    const project = projects.find((p) => p.caseIds.includes(caseId));
    const hearing = [...(feed?.active ?? []), ...(feed?.upcomingOnly ?? []), ...(feed?.completed ?? [])].find((h) => h.appId === caseId);
    const configuredCase = project?.cases.find((c) => c.id === caseId);
    const planId = hearing?.energovPlanId ?? configuredCase?.portalUrl.match(/\/plan\/([^?]+)/)?.[1];
    const portalUrl = planId && locality.energov ? locality.energov.planPortalUrl(planId) : undefined;
    if (planId && portalUrl && locality.energov) {
      const [plan, attachments] = await Promise.all([
        locality.energov.getPlan(planId, { revalidate: 0 }).catch((error: unknown) => { warnings.push(caseId + " case record unavailable: " + String(error)); return null; }),
        locality.energov.getPlanAttachments(planId, { revalidate: 0 }).catch((error: unknown) => { warnings.push(caseId + " document list unavailable: " + String(error)); return null; }),
      ]);
      if (plan) {
        const fields: NonNullable<SourceDocument["fields"]> = [];
        const add = (key: FieldKey, value: string | undefined, label: string) => { if (value) fields.push({ key, value, quote: label + ": " + value, page: null }); };
        add("appliedDate", dateOnly(plan.ApplyDate), "ApplyDate"); add("lastActionDate", dateOnly(plan.LastActionDate), "LastActionDate");
        add("caseStatus", plan.PlanStatus, "PlanStatus");
        documents.push({ url: portalUrl, title: caseId + " official case record", caseIds: [caseId], kind: "case-record", content: JSON.stringify({ plan, attachments }), fields });
      }
      for (const attachment of attachments ?? []) {
        const title = attachment.FileName + (attachment.Notes ? " — " + attachment.Notes : "");
        if (attachment.IsFileSecure || !attachment.IsOnline || documentKind(title) === "other") continue;
        if (attachment.FilePath && officialDocumentUrl(attachment.FilePath)) documents.push({ url: attachment.FilePath, title, caseIds: [caseId], kind: documentKind(title) });
        else warnings.push(caseId + ": " + attachment.FileName + " requires a verified direct download URL in the source registry.");
      }
    }
    for (const source of project?.sourceDocuments ?? []) {
      if (source.caseIds.includes(caseId) && /historyattachment|\.pdf(?:\?|$)/i.test(source.url)) documents.push({ url: source.url, title: source.label, caseIds: source.caseIds.filter((id) => caseIds.includes(id)), kind: documentKind(source.label) });
    }
    // The city's explicit public-hearing schedule is distinct from an agenda item authorizing a future hearing.
    for (const meeting of hearing?.meetings ?? []) {
      if (meeting.continuedNote) continue;
      const key = /council/i.test(meeting.body) ? "councilHearingDate" : /P&Z|Planning/i.test(meeting.body) ? "pzHearingDate" : undefined;
      if (key) documents.push({ url: meeting.sourceUrl + (meeting.sourceUrl.includes("#") ? "" : "#case-" + caseId + "-" + meeting.date), title: caseId + " public hearing schedule", caseIds: [caseId], kind: "agenda", content: JSON.stringify(meeting), meeting: { body: meeting.body, date: meeting.date, isHearing: true }, fields: [{ key, value: meeting.date, quote: meeting.bodyLabel + " — " + meeting.dateLabel, page: null }] });
    }
  }
  if (lastCase && options.store) await options.store.mutate((state) => { state.cursor = caseIds[(caseIds.indexOf(lastCase!) + 1) % caseIds.length]; });
  // Manual source registry supplies only official URLs, never extracted facts or approvals.
  if (process.env.TIMELINE_SOURCE_REGISTRY) {
    const registry = JSON.parse(process.env.TIMELINE_SOURCE_REGISTRY) as SourceDocument[];
    for (const source of registry) if (Array.isArray(source.caseIds) && source.caseIds.some((id) => caseIds.includes(id)) && officialDocumentUrl(source.url)) documents.push({ url: source.url, title: source.title, caseIds: source.caseIds.filter((id) => caseIds.includes(id)), kind: documentKind(source.title) });
  }
  const years = [...new Set(caseIds.map((id) => Number(id.slice(-4))).concat(new Date().getFullYear()))].filter((year) => year >= 2023 && year <= new Date().getFullYear());
  const meetingLists = await Promise.all([
    officialRequest(NAMPA_PRIMEGOV_ORIGIN + "/api/v2/PublicPortal/ListUpcomingMeetings").then((r) => r.json()).then(parsePrimeGovMeetings).catch((error) => { warnings.push("Upcoming agendas unavailable: " + String(error)); return []; }),
    ...years.map((year) => officialRequest(NAMPA_PRIMEGOV_ORIGIN + "/api/v2/PublicPortal/ListArchivedMeetings?year=" + year).then((r) => r.json()).then(parsePrimeGovMeetings).catch((error) => { warnings.push("Archived agendas unavailable for " + year + ": " + String(error)); return []; })),
  ]);
  const priorityAgendas = new Set(projects.filter((project) => project.caseIds.some((id) => caseIds.includes(id))).flatMap((project) => project.sourceDocuments ?? []).map((source) => source.url.split("#")[0]));
  const meetings = [...new Map(meetingLists.flat().map((meeting) => [meeting.id, meeting])).values()].filter((m) => !/attendance|state of the city/i.test(m.title)).sort((a, b) => Number(priorityAgendas.has(b.htmlAgendaUrl ?? "")) - Number(priorityAgendas.has(a.htmlAgendaUrl ?? "")) || b.date.localeCompare(a.date));
  for (let i = 0; i < meetings.length; i += 6) {
    if (Date.now() > deadline) { warnings.push("Agenda discovery time limit reached; remaining agendas will be retried."); break; }
    await Promise.all(meetings.slice(i, i + 6).map(async (meeting) => {
      if (!meeting.htmlAgendaUrl) {
        if (!meeting.agendaUrl) return;
        try {
          const bytes = await downloadDocument(meeting.agendaUrl);
          const hash = digest(bytes);
          const previous = cached.documents[digest(meeting.agendaUrl)];
          const pages = previous?.hash === hash && previous.pages.length ? previous.pages : await ocrMissingPages(bytes, await extractNativePdfPages(bytes));
          extractedPages.set(hash, pages);
          const text = pages.map((page) => page.text).join("\n");
          const matchedIds = caseIds.filter((caseId) => new RegExp("\\b" + caseId + "\\b", "i").test(text));
          documents.push({ url: meeting.agendaUrl, title: meeting.title + " — " + meeting.date, caseIds: matchedIds, kind: "agenda", meeting: { body: meeting.body, date: meeting.date, isHearing: false, minutesUrl: meeting.minutesUrl }, fields: [] });
          if (matchedIds.length && meeting.minutesUrl) documents.push({ url: meeting.minutesUrl, title: meeting.title + " minutes — " + meeting.date, caseIds: matchedIds, kind: "minutes" });
        } catch (error) { warnings.push("PDF agenda " + meeting.id + " unavailable: " + String(error)); }
        return;
      }
      try {
        const html = await (await officialRequest(meeting.htmlAgendaUrl)).text();
        const items = parsePrimeGovAgenda(html, meeting.htmlAgendaUrl).filter((item) => item.caseIds.some((id) => caseIds.includes(id)));
        if (!items.length) return;
        const matchedIds = [...new Set(items.flatMap((item) => item.caseIds).filter((id) => caseIds.includes(id)))];
        const $ = load(html);
        documents.push({ url: meeting.htmlAgendaUrl, title: meeting.title + " — " + meeting.date, caseIds: matchedIds, kind: "agenda", content: JSON.stringify({ meeting, items }), meeting: { body: meeting.body, date: meeting.date, isHearing: false, minutesUrl: meeting.minutesUrl }, fields: [] });
        for (const item of items) {
          const linkedIds = item.caseIds.filter((id) => caseIds.includes(id));
          const anchor = new URL(item.agendaUrl).hash.slice(1);
          const element = anchor ? $("[id]").filter((_i, e) => $(e).attr("id") === decodeURIComponent(anchor)) : null;
          element?.find(".attachment-holder a[href]").each((_j, node) => {
            const title = $(node).text().trim() || $(node).attr("title") || "";
            const url = new URL($(node).attr("href")!, NAMPA_PRIMEGOV_ORIGIN).href;
            if (documentKind(title) !== "other" && /historyattachment|download|\.pdf/i.test(url) && officialDocumentUrl(url)) documents.push({ url, title, caseIds: linkedIds, kind: documentKind(title) });
          });
          for (const report of item.staffReports) documents.push({ url: report.url, title: report.label, caseIds: linkedIds, kind: "staff-report" });
        }
        if (meeting.minutesUrl) {
          const content = /\/Portal\/Meeting/i.test(meeting.minutesUrl) ? load(await (await officialRequest(meeting.minutesUrl)).text())("body").text().replace(/\s+/g, " ").trim() : undefined;
          documents.push({ url: meeting.minutesUrl, title: meeting.title + " minutes — " + meeting.date, caseIds: matchedIds, kind: "minutes", ...(content ? { content } : {}) });
        }
      } catch (error) { warnings.push("Agenda " + meeting.id + " unavailable: " + String(error)); }
    }));
  }
  // Merge associations so shared reports are downloaded and transcribed once.
  const unique = new Map<string, SourceDocument>();
  for (const document of documents) { const old = unique.get(document.url); unique.set(document.url, old ? { ...old, caseIds: [...new Set([...old.caseIds, ...document.caseIds])] } : document); }
  return { documents: [...unique.values()], warnings, caseIds, extractedPages };
}
