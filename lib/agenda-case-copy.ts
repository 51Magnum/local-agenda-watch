import type { HearingFeed } from "./localities/types";
import { caseCatalog } from "./case-catalog";
import { cleanResidentTitle, cleanResidentProse, readableLocation } from "./resident-copy";
import type { MeridianCase } from "./sources/meridian";

export type AgendaCaseCopy = { name: string; headline: string; explanation: string; sourceUrl: string; date: string; where?: string };
const caseNumbers = /\b(?:[A-Z]{1,6}-\d{4}-\d{1,6}(?:-(?:MOD|APL)\d*)?|\d{2}-\d{2,3}-[A-Z]+)\b/gi;
const number = (value: string) => value.match(/\(([\d,]+)\)/)?.[1] ?? value.match(/[\d,]+/)?.[0];

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
  const text = cleanResidentProse(source.text).split(/\bOriginal Concept\s*:/i)[0].replace(/^\s*(?:\d+[.)]\s*)?PUBLIC HEARING\s*(?:FOR|ON)?\s*[:–—-]?\s*/i, "");
  const clean = text.replace(caseNumbers, "").replace(/^Case No\.?\s*/i, "").replace(/\(\s*\)|^[\s/,&:–—-]+/g, "").replace(/^\(continued[^)]*\)\s*/i, "").trim();
  const extension = text.match(/(?:new termination|expiration) date of\s+([A-Z][a-z]+ \d{1,2},? 20\d{2})/i);
  const term = text.match(/(?:additional|extend(?:ed)?(?:\s+the\s+term)?(?:\s+by)?)\s+([a-z]+\s*\([\d]+\)|[\d]+)\s*years?/i);
  const agreementName = text.match(/development agreement for\s+(.+?)\s+(?:to establish|to extend|[–—:])/i)?.[1];
  const prefix = text.includes(caseId) ? text.slice(0,text.indexOf(caseId)).replace(caseNumbers, "").replace(/\([^)]*$/, "").replace(/[ /&,()–—-]+/g," ").trim() : "";
  const heading = clean.split(/\s+[–—]\s+|\s+-\s+|:/)[0].replace(/^(?:For\s+)?(?:a\s+)?(?:Public Hearing\s+)?(?:for\s+)?/i, "").trim();
  const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
  const shortName=(s:string|undefined)=>!!s&&s.length<120&&s.split(/\s+/).length<=16&&/[a-z]{3}/i.test(s)&&!/^case no\b/i.test(s)&&!/(?:located|requesting|representing|planner|original concept)/i.test(s);
  const known=[hearing?.displayTitle,hearing?.appScope].find(n=>shortName(n??undefined)&&normalized(text).includes(normalized(n!)));
  const named=text.match(/\b(?:approval|community|plat) for\s+([^,;:]+?)(?:\s+in\b|,|\s+on\b|$)/i)?.[1];
  const policy=/SH[ -]?16 Specific Area Plan/i.test(text)?"SH-16 Specific Area Plan":/transmission line/i.test(text)?"Transmission line regulations":undefined;
  const name = cleanResidentTitle(agreementName ?? known ?? policy ?? (shortName(prefix)?prefix:shortName(named)?named!:shortName(heading)?heading:hearing?.appTypeLabel??"Planning proposal"));
  const count = text.match(/\b([a-z]+\s*\([\d,]+\)|[\d,]+)\s+(buildable|building|residential)\s+lots?\b/i);
  const acres = text.match(/\b(?:on\s+(?:about\s+|approximately\s+)?|(?:the\s+)?)([\d,.]+)[ -]acres?\b/i)?.[1];
  const lightIndustrial = /\bI-L\b/.test(text);
  const residential=text.match(/\b(\d+)[ -]+residential\b/i)?.[1],totalLots=text.match(/\b(\d+)[ -]+lots?\b/i)?.[1];
  const dwellings=text.match(/\b([\d,]+)\s+(?:dwelling units?|dwellings|homes)\b/i)?.[1];
  const zones=text.match(/\bfrom\s+(?:the\s+)?([A-Z][A-Z0-9-]*)\s*(?:\([^)]*\))?\s+to\s+(?:the\s+)?([A-Z][A-Z0-9-]*)\b/);
  const designation=text.match(/\bfrom\s+(Community Mixed Use|Low Density Residential|Medium[- ]High Density Residential)\s+to\s+(Industrial|Light Industrial|Mixed Use Regional)\b/i);
  let action = /\bfirst extension\b/i.test(text) ? "First extension of final plat approval"
    : /transmission line/i.test(text) ? "Update transmission line regulations"
    : /group (?:residence|homes?)/i.test(text)&&/gateway business/i.test(text) ? "Update group residence definitions and Gateway Business building rules"
    : /SH[ -]?16 Specific Area Plan/i.test(text)&&/light industrial/i.test(text) ? "Change SH-16 plan designations to light industrial and industrial"
    : designation ? `Change land-use designation from ${designation[1].toLowerCase()} to ${designation[2].toLowerCase()}`
    : /master planned community/i.test(text)&&/annexation/i.test(text) ? "Annexation and zoning for a master-planned community"
    : zones&&/rezone|zone change|zoning/i.test(text) ? `Change zoning from ${zones[1]} to ${zones[2]}`
    : /daycare center/i.test(text) ? "Conditional use permit for a daycare center"
    : /law office/i.test(text) ? "Rezone property for a law office"
    : /light industry/i.test(text)&&/conditional use/i.test(text) ? "Permit office, storage and manufacturing uses"
    : /mixed.use development/i.test(text) ? "Rezone and permit a mixed-use development"
    : /development agreement/i.test(text) ? "Modify the development agreement"
    : /comprehensive plan.*map|comprehensive plan map/i.test(text) ? "Change comprehensive plan land-use designations"
    : /comprehensive plan text/i.test(text) ? "Amend the comprehensive plan text"
    : /easement vacation/i.test(text) ? "Vacate an easement"
    : /annexation|annex /i.test(text) ? `Annex${acres?" "+acres+" acres of":""} land into the city`
    : /preliminary plat|final plat/i.test(text) ? "Approve a subdivision plat"
    : /conditional use permit/i.test(text) ? "Consider a conditional use permit"
    : /code|ordinance|UDC/i.test(text) ? "Amend development code rules" : "Review the proposed planning application";
  action=action.charAt(0).toUpperCase()+action.slice(1);
  let headline: string;
  if (extension && agreementName) headline = `${name}: ${term ? number(term[1])+"-year " : ""}development agreement extension to ${extension[1]}`;
  else if (count) headline = `${number(count[1])} ${count[2].toLowerCase()} lots${acres ? " on "+acres+" acres" : ""}${lightIndustrial ? " in the I-L light industrial zone" : ""}`;
  else if (residential&&totalLots) headline = `${residential} residential lots in a ${totalLots}-lot subdivision${acres?" on "+acres+" acres":""}`;
  else if (dwellings) headline = `${dwellings} dwellings${acres?" on "+acres+" acres":""}`;
  else headline = `${name}: ${action.charAt(0).toLowerCase()+action.slice(1)}`;
  const explanation = extension && agreementName ? `The proposal would extend ${name}’s development agreement${term ? " by "+number(term[1])+" years" : ""}, to ${extension[1]}.`
    : count ? `${/\bplat\b/i.test(text) ? "A preliminary plat would divide the property into" : "The proposal includes"} ${number(count[1])} ${count[2].toLowerCase()} lots${acres ? " on about "+acres+" acres" : ""}${lightIndustrial ? " in the I-L light industrial zone" : ""}.`
    : `${headline}. The published agenda describes the request being considered.`;
  const location = text.match(/\b(?:is\s+)?(?:generally\s+)?located\s+((?:on|at|approximately|generally|near)\b.+?)(?=\s+This item\b|\s+Applicant:|$)/i)?.[1];
  // Street initials ("W. Franklin Rd.") are not sentence boundaries.
  const where = location ? readableLocation(location.replace(/\s+[A-Z]\.\s*(?:Request|Applicant|Application|Staff)\b.*$/i, "").replace(/\.\s+(?:This|The|Applicant|Staff)\b.*$/i, "").replace(/^\s*(?:on|at)\s+/i, "").replace(/\s*\([A-Z]{2,5}\)\s*$/, "").replace(/[.\s]+$/, "")) : undefined;
  return { name, headline, explanation, sourceUrl: source.url, date: source.date, where };
}
