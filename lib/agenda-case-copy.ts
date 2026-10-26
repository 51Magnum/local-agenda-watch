import type { HearingFeed } from "./localities/types";
import { caseCatalog } from "./case-catalog";
import { cleanResidentTitle, cleanResidentProse, readableLocation } from "./resident-copy";
import type { MeridianCase } from "./sources/meridian";

export type AgendaCaseCopy = { name: string; headline: string; explanation: string; sourceUrl: string; date: string; where?: string };
const caseNumbers = /\b(?:[A-Z]{1,6}-\d{4}-\d{1,6}(?:-(?:MOD|APL)\d*)?|\d{2}-\d{2,3}-[A-Z]+)\b/g;
const number = (value: string) => value.match(/\(([\d,]+)\)/)?.[1] ?? value.match(/[\d,]+/)?.[0];
const sentence = (value: string) => value.split(/(?<=[.!?])\s+(?=[A-Z])/)[0].replace(/[.\s]+$/, "");

/** Only the exact case's upcoming agenda item (or its case-specific hearing notice).
 * Never borrows a different case's proposal because it shares a polygon or document.
 */
export function agendaCaseCopy(feed: HearingFeed | undefined, caseId: string, timezone = "America/Denver", now = new Date(), meeting?: { date: string; body: string }): AgendaCaseCopy | undefined {
  if (!feed) return;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  const hearing = caseCatalog(feed).find(h => h.appId === caseId);
  const scheduled = (feed.agendaMeetings ?? []).filter(m => m.date >= today && (!meeting || m.date === meeting.date && m.body === meeting.body) && (!hearing || hearing.meetings.some(h => h.date === m.date && h.body === m.body))).sort((a,b) => a.date.localeCompare(b.date));
  let source = scheduled.flatMap(m => m.items.filter(i => i.caseIds.includes(caseId)).map(i => ({ text: i.title, date: m.date, url: i.agendaUrl || m.sourceUrl })))[0];
  // Some portals expose the complete request in the notice but only a name in the agenda.
  const appearance = hearing?.meetings.filter(m => m.date >= today && !m.continuedNote && (!meeting || m.date === meeting.date && m.body === meeting.body)).sort((a,b) => a.date.localeCompare(b.date))[0];
  const notice = appearance ? (hearing as MeridianCase | undefined)?.meridian?.notices.find(n => n.date === appearance.date && n.body === appearance.body && n.caseIds.includes(caseId)) : undefined;
  const description = notice?.description ?? (!(hearing as MeridianCase | undefined)?.meridian ? hearing?.description : undefined);
  if ((!source || source.text.length < 100) && appearance && description?.includes(caseId)) source = { text: description, date: appearance.date, url: notice?.sourceUrl ?? appearance.sourceUrl };
  if (!source || !source.text.trim()) return;
  const text = cleanResidentProse(source.text).replace(/^\s*(?:\d+[.)]\s*)?PUBLIC HEARING\s*(?:FOR|ON)?\s*[:–—-]?\s*/i, "");
  const clean = text.replace(caseNumbers, "").replace(/\(\s*\)|^[\s/,:–—-]+/g, "").trim();
  const extension = text.match(/(?:new termination|expiration) date of\s+([A-Z][a-z]+ \d{1,2},? 20\d{2})/i);
  const term = text.match(/(?:additional|extend(?:ed)?(?:\s+the\s+term)?(?:\s+by)?)\s+([a-z]+\s*\([\d]+\)|[\d]+)\s*years?/i);
  const agreementName = text.match(/development agreement for\s+(.+?)\s+(?:to establish|to extend|[–—:])/i)?.[1];
  const prefix = text.includes(caseId) ? text.slice(0,text.indexOf(caseId)).replace(/\([^)]*$/, "").trim() : "";
  const heading = clean.split(/\s+[–—]\s+|\s+-\s+|:/)[0].replace(/^(?:For\s+)?(?:a\s+)?(?:Public Hearing\s+)?(?:for\s+)?/i, "").trim();
  const name = cleanResidentTitle(agreementName ?? (prefix.length > 3 && prefix.length < 140 ? prefix : heading), hearing?.displayTitle ?? hearing?.appTypeLabel ?? "Planning proposal");
  const count = text.match(/\b([a-z]+\s*\([\d,]+\)|[\d,]+)\s+(buildable|building|residential)\s+lots?\b/i);
  const acres = text.match(/\b(?:on\s+(?:about\s+|approximately\s+)?|(?:the\s+)?)([\d,.]+)[ -]acres?\b/i)?.[1];
  const lightIndustrial = /\bI-L\b/.test(text);
  let headline: string;
  if (extension && agreementName) headline = `${name}: ${term ? number(term[1])+"-year " : ""}development agreement extension to ${extension[1]}`;
  else if (count) headline = `${number(count[1])} ${count[2].toLowerCase()} lots${acres ? " on "+acres+" acres" : ""}${lightIndustrial ? " in the I-L light industrial zone" : ""}`;
  else headline = cleanResidentTitle(sentence(clean.split(/\bApplicant:/i)[0]), name);
  const request = text.match(/\b(?:is|are) requesting\s+(.+)/i)?.[1];
  const explanation = extension && agreementName ? `The proposal would extend ${name}’s development agreement${term ? " by "+number(term[1])+" years" : ""}, to ${extension[1]}.`
    : count ? `${/\bplat\b/i.test(text) ? "A preliminary plat would divide the property into" : "The proposal includes"} ${number(count[1])} ${count[2].toLowerCase()} lots${acres ? " on about "+acres+" acres" : ""}${lightIndustrial ? " in the I-L light industrial zone" : ""}.`
    : sentence((request ? "The proposal requests "+request : clean).split(/\bApplicant:/i)[0]).replace(/^For\s+(?:a|an)\s+/i,"A ")+".";
  const location = text.match(/\b(?:is\s+)?(?:generally\s+)?located\s+((?:on|at|approximately|generally|near)\b.+?)(?=\s+This item\b|\s+Applicant:|$)/i)?.[1];
  // Street initials ("W. Franklin Rd.") are not sentence boundaries.
  const where = location ? readableLocation(location.replace(/\.\s+(?:This|The|Applicant|Staff)\b.*$/i, "").replace(/^\s*(?:on|at)\s+/i, "").replace(/\s*\([A-Z]{2,5}\)\s*$/, "").replace(/[.\s]+$/, "")) : undefined;
  return { name, headline, explanation, sourceUrl: source.url, date: source.date, where };
}
