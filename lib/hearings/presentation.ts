import type { ProjectHearing } from "../projects";
import { localHearingDate } from "./types";

export function publicMeetingUrl(value?:string) {
  if(!value)return;
  try{const url=new URL(value);if(url.protocol==="https:"&&!url.username&&!url.password)return url.href;}catch{}
}
/** A specific official event/meeting page, rather than a portal or calendar landing page. */
export function directMeetingRecord(value?:string){
 const url=publicMeetingUrl(value);if(!url)return;
 const u=new URL(url);return /(?:meetingTemplateId|eventId|meetingId|event_id)=/i.test(u.search)||/\/(?:Portal\/Meeting|AgendaViewer\.php|Meetings\/Details\/|AgendaCenter\/ViewFile\/)/i.test(u.pathname)?url:undefined;
}
export function meetingAction(next:ProjectHearing) {
  const agenda=publicMeetingUrl(next.agenda_url??next.agendaUrl);
  const meeting=publicMeetingUrl(next.meeting_url);
  const url=agenda??meeting;
  return {url,label:agenda?"View meeting agenda":directMeetingRecord(meeting)?"View meeting record":"Meeting portal",packet:publicMeetingUrl(next.packet_url??next.packetUrl),agendaPublished:!!agenda};
}
export function hearingWithinDays(next:ProjectHearing,timezone:string,now=new Date(),days=14) {
  const day=localHearingDate(next.meeting_datetime??next.startsAt,timezone),today=localHearingDate(now.toISOString(),timezone);
  const difference=(Date.parse(day+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000;
  return difference>=0&&difference<=days;
}
/** A deadline can render only together with its explicit public source. */
export function hearingDeadlines(next:ProjectHearing) {
  const portal=next.comment_deadline??next.commentDeadline,source=publicMeetingUrl(next.comment_deadline_source_url??next.commentSourceUrl);
  const staffSource=publicMeetingUrl(next.staff_report_deadline_source_url);
  return [
    ...(portal&&source?[{label:next.comment_deadline_label??"Written comments",at:portal,source,email:undefined as string|undefined}]:[]),
    ...(next.staff_report_deadline&&staffSource?[{label:"Comments included in staff report",at:next.staff_report_deadline,source:staffSource,email:next.comment_email}]:[]),
  ];
}
