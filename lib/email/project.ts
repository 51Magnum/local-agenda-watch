import type { PaneData } from "../maps/project-questions";
import { areaPath } from "../areas/registry";
import { getProjectForCase } from "../projects";
import { hearingDateTime } from "../areas/format";
import { protectMapCase, redactResidence } from "../residential-privacy";
import { reconcileDecisionHistory } from "../maps/project-status";
import { SITE_ORIGIN } from "../site-config";
import { distance } from "@turf/turf";

export type ProjectSnapshot = {
  version: 2; key: string; areaId: string; caseId: string; name: string; headline: string;
  where: string; jurisdiction: string; timezone: string; status: string; decisionDate?: string;
  next?: { body: string; startsAt: string; location?: string; role: string; deadline?: string; deadlineSource?:string; meetingUrl?:string; agendaUrl?:string; packetUrl?:string; agendaItem?:string;staffDeadline?:string;staffDeadlineSource?:string };
  documents: { label: string; url: string; hash?:string }[]; history: string[];
  commentInstructions?:string;commentUrl?:string;
};
export type EmailProject = {
  snapshot: ProjectSnapshot; data: PaneData; changes: string[];
  distance?: { miles: number; label: string };
};
export type WatchState = { version: 2; projects: Record<string, ProjectSnapshot> };
export type WatchTarget = { kind: "project"; areaId: string; caseId: string } | { kind: "place"; label: string; coordinates: [number, number]; radiusMiles: number };
export type StoredWatchTarget = WatchTarget | { kind: "pending"; label: string };
export const snapshotFingerprint=(snapshot:ProjectSnapshot)=>JSON.stringify(snapshot,(_key,value)=>value&&typeof value==="object"&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
/** Compare official status values, never capitalization or generated timeline prose. */
const statusKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g," ");
export const isClosedProject = (status: string) => /^(?:approved|denied|withdrawn|cancelled|canceled|decided|recorded|complete|completed)\b/i.test(status.trim());
export const statusCopy = (value: string) => value.replace(/\bwithdrawn\b/gi, "Withdrawn").replace(/\bapproved\b/gi,"Approved").replace(/\bdenied\b/gi,"Denied");
export const localDay = (date: Date, timezone = "America/Denver") => new Intl.DateTimeFormat("en-CA", {timeZone:timezone}).format(date);
export function dateOnly(value: string, timezone = "America/Denver") {
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:value.length===10?"UTC":timezone}).format(new Date(value.length===10?value+"T12:00:00Z":value));
}
export function canonicalProjectUrl(data: PaneData) {
  const id = data.item.id.split(":").at(-1)!;
  const project = getProjectForCase(id,data.area.id);
  return SITE_ORIGIN+(project?areaPath(data.area.id)+"/"+project.slug:data.item.href);
}
export function emailProject(data: PaneData, previous?: ProjectSnapshot, place?: Extract<WatchTarget,{kind:"place"}>, now=new Date()): EmailProject {
  // Defense in depth: every email surface shares the pane's residential identity policy.
  const item = protectMapCase(data.area.id,data.item);
  const safe = {...data,item};
  if(item.residentialPrivacy){safe.where=data.where?redactResidence(data.where):undefined;safe.documents=[];safe.impacts=[];safe.history=[{label:statusCopy(item.recordStatus?.match(/approved|denied|withdrawn|in review|pending|submitted|filed/i)?.[0]??item.stage)}];}
  const closed = data.participationClosed || ["Decided","Recorded"].includes(item.stage) || /withdrawn|cancelled|canceled/i.test(item.recordStatus??"");
  const next = !closed && data.next && (data.next.startsAt.length===10 ? data.next.startsAt>=localDay(now,data.area.timezone) : Date.parse(data.next.startsAt)>now.getTime()) ? data.next : undefined;
  const displayName=(value:string)=>value.replace(/\bat\s+0\s+(?=[A-Za-z])/i,"near ").replace(/\bId\b(?=\s+\d{5}|$)/g,"ID");
  const snapshot: ProjectSnapshot = {
    version:2,key:canonicalProjectUrl(safe),areaId:data.area.id,caseId:item.id.split(":").at(-1)!,
    name:displayName(item.popup?.projectName??item.title),headline:displayName(item.popup?.headline??item.title),
    where:safe.where??"Location not yet verified",jurisdiction:data.area.name,timezone:data.area.timezone,
    status:statusCopy(item.recordStatus??item.stage),decisionDate:item.decisionDate,
    next:next?{body:next.body,startsAt:next.startsAt,location:next.location,role:next.role,deadline:next.commentSourceUrl?next.commentDeadline:undefined,deadlineSource:next.commentSourceUrl,meetingUrl:next.meeting_url,agendaUrl:next.agenda_url??next.agendaUrl,packetUrl:next.packet_url??next.packetUrl,agendaItem:next.agenda_item_number,staffDeadline:next.staff_report_deadline_source_url?next.staff_report_deadline:undefined,staffDeadlineSource:next.staff_report_deadline_source_url}:undefined,
    documents:(safe.documents??[]).map(d=>({label:d.label,url:d.url,hash:d.hash})).sort((a,b)=>a.url.localeCompare(b.url)),
    history:reconcileDecisionHistory(item,safe.history).map(h=>statusCopy(h.label)),
    commentInstructions:data.commentInstructions,commentUrl:data.commentUrl,
  };
  return {snapshot,data:safe,changes:previous?projectDiff(previous,snapshot,now):[],distance:place&&item.centroid?{miles:distance(place.coordinates,item.centroid,{units:"miles"}),label:place.label}:undefined};
}
export function projectDiff(before: ProjectSnapshot, after: ProjectSnapshot, now=new Date()): string[] {
  const changes:string[]=[];
  const sameTime=(a?:string,b?:string)=>a===b||!!a&&!!b&&a.length>10&&b.length>10&&Date.parse(a)===Date.parse(b);
  if(!sameTime(before.next?.startsAt,after.next?.startsAt)){
    if(before.next&&after.next)changes.push(`Hearing moved from ${hearingDateTime(before.next.startsAt,before.timezone)} to ${hearingDateTime(after.next.startsAt,after.timezone)}.`);
    else if(after.next)changes.push(`${after.next.body} hearing posted: ${hearingDateTime(after.next.startsAt,after.timezone)}.`);
    else if(before.next&&(before.next.startsAt.length===10?before.next.startsAt>=localDay(now,before.timezone):Date.parse(before.next.startsAt)>now.getTime()))changes.push("The previously listed hearing is no longer upcoming. Check the official record for the current schedule or outcome.");
  }
  if(before.next&&after.next&&before.next.body!==after.next.body)changes.push(`Hearing body changed from ${before.next.body} to ${after.next.body}.`);
  if(before.next&&after.next&&before.next.location!==after.next.location)changes.push(`Hearing location changed to ${after.next.location??"a location not yet published"}.`);
  if(after.next?.agendaUrl&&before.next?.agendaUrl!==after.next.agendaUrl)changes.push("Official meeting agenda posted or updated.");
  if(after.next?.packetUrl&&before.next?.packetUrl!==after.next.packetUrl)changes.push("New staff report / meeting packet posted.");
  if(after.next?.agendaItem&&before.next?.agendaItem!==after.next.agendaItem)changes.push(`Agenda item ${after.next.agendaItem} matched to this project.`);
  const lostOutcome = /^(approved|denied|withdrawn)\b/i.test(before.status) && /^(decided|complete|completed)\b/i.test(after.status);
  if(!lostOutcome&&(statusKey(before.status)!==statusKey(after.status)||before.decisionDate!==after.decisionDate)){
    const decision = `${statusCopy(after.status)}${after.decisionDate?" "+dateOnly(after.decisionDate,after.timezone):""}`;
    changes.push(`Official record updated: ${decision}.`);
  }
  // Headlines, location descriptions and timeline labels are presentation, not events.
  // Hearing, status and document changes below carry the underlying record changes.
  for(const d of after.documents)if(!before.documents.some(old=>old.url===d.url))changes.push(/staff.*report/i.test(d.label)?`New staff report posted: ${d.label}.`:`New official document posted: ${d.label}.`);
  else if(before.documents.some(old=>old.url===d.url&&(old.hash&&d.hash&&old.hash!==d.hash)))changes.push(`Official document updated: ${d.label}.`);
  if(!sameTime(before.next?.deadline,after.next?.deadline)&&after.next?.deadline)changes.push(`Comment deadline updated: ${hearingDateTime(after.next.deadline,after.timezone)}.`);
  if(!isClosedProject(after.status)&&before.commentUrl!==after.commentUrl)changes.push("Official comment and submission instructions changed. Review the current participation information below.");
  if(before.next?.deadline&&!after.next?.deadline&&after.next)changes.push("The previously listed comment deadline is no longer published. Check the official notice for current participation options.");
  if(after.next?.staffDeadline&&(!sameTime(before.next?.staffDeadline,after.next.staffDeadline)||before.next?.staffDeadlineSource!==after.next.staffDeadlineSource))changes.push(`Staff report deadline updated: ${hearingDateTime(after.next.staffDeadline,after.timezone)}.`);
  return [...new Set(changes)];
}
/** Lead-case canonical URLs come from projectDetail, including city/county site merging. */
export function dedupeProjects(projects: EmailProject[]): EmailProject[] {
  const byKey = new Map<string,EmailProject>();
  for(const p of projects){
    const old=byKey.get(p.snapshot.key);
    byKey.set(p.snapshot.key,old?{...old,changes:[...new Set([...old.changes,...p.changes])],distance:old.distance??p.distance}:p);
  }
  return [...byKey.values()];
}
export function digestSubject(projects: EmailProject[], placeLabel?: string) {
  projects=dedupeProjects(projects);
  const count=projects.length;
  if(!count)throw Error("Cannot render an empty digest");
  const first=projects[0].snapshot;
  if(count===1){
    if(first.next){const day=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:first.timezone}).format(new Date(first.next.startsAt.length===10?first.next.startsAt+"T12:00:00Z":first.next.startsAt));return `${first.name}: ${first.next.body} hearing ${day}`;}
    return `${first.name}: project record updated`;
  }
  return `${count} updates${placeLabel?" near "+placeLabel:" to your watched projects"}: ${first.name} and ${count-1} more`;
}
export function isReminderDue(project: EmailProject, now=new Date()) {
  const next=project.snapshot.next;if(!next)return false;
  const days=(Date.parse(localDay(new Date(next.startsAt.length===10?next.startsAt+"T12:00:00Z":next.startsAt),project.snapshot.timezone))-Date.parse(localDay(now,project.snapshot.timezone)))/86400000;
  return days===2;
}
