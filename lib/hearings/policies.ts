import { denverInstant } from "../case-details";
import type { ProjectHearing } from "../projects";
import { hearingBody, localHearingDate, type HearingMeetingFields } from "./types";

export const NAMPA_PORTAL="https://nampa.primegov.com/public/portal";
export const NAMPA_HEARING_BASICS="https://www.cityofnampa.us/1722/Public-Hearings---the-Basics";
export const NAMPA_COMMENT_RULES="https://www.cityofnampa.us/1616/Public-Comment";
export const NAMPA_TESTIMONY_RULES="https://www.cityofnampa.us/DocumentCenter/View/13710/Chapter-2-Enforcement-and-Administration---Updated-04-01-2024?bidId=#page=18";
function previousWeekday(day: string, weekday: number) {
  const d=new Date(day+"T12:00:00Z");
  let days=(d.getUTCDay()-weekday+7)%7;if(!days)days=7;
  d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10);
}
/** Relative dates are calculated in the hearing's local calendar, including DST changes. */
export function nampaHearingPolicy(next: ProjectHearing): HearingMeetingFields {
  const day=localHearingDate(next.startsAt),body=hearingBody(next.body);
  if(!["P&Z","City Council"].includes(body))return {};
  return {
    meeting_url:NAMPA_PORTAL,
    meeting_body:body==="City Council"?"Nampa City Council":"Nampa Planning & Zoning Commission",
    meeting_datetime:next.startsAt,
    agenda_expected_at:denverInstant(previousWeekday(day,4),"17:00"),
    agenda_expected_source_url:NAMPA_HEARING_BASICS,
    agenda_expected_note:"Normally posted by the end of the preceding Thursday; timing may vary.",
    staff_report_deadline:denverInstant(previousWeekday(day,3),"12:00"),
    staff_report_deadline_source_url:NAMPA_HEARING_BASICS,
    comment_email:"PZall@cityofnampa.us",
    testimony_source_url:NAMPA_TESTIMONY_RULES,
    testimony_rules:"Standard public testimony: 3 minutes per person. Applicant presentation: 7 minutes; applicant rebuttal: 5 minutes. The chair may announce different limits.",
    testimony_source_label:"Nampa code 10-2-8.C",
    speak_signup_note:"Sign-up opens when the agenda posts; city guidance also permits sign-up at the meeting.",
    ...(next.meeting_kind!=="special"?{
      comment_deadline:denverInstant(day,"12:00"),comment_deadline_source_url:NAMPA_COMMENT_RULES,
      comment_deadline_label:"Portal comments",
      speak_signup_url:NAMPA_PORTAL,
    }:{}),
  };
}
export function enrichHearing(areaId: string, next: ProjectHearing, stored?: HearingMeetingFields): ProjectHearing {
  const merged={...next,...stored};
  const policy=areaId==="nampa"?nampaHearingPolicy(merged):{};
  const result: ProjectHearing={...next,...policy,...stored};
  // Old records remain readable, but an unsourced deadline never becomes public.
  result.comment_deadline=stored?.comment_deadline??(next.commentSourceUrl?next.commentDeadline:undefined)??policy.comment_deadline;
  result.comment_deadline_source_url=stored?.comment_deadline_source_url??next.commentSourceUrl??policy.comment_deadline_source_url;
  if(!result.comment_deadline_source_url)result.comment_deadline=undefined;
  if(result.comment_deadline_source_url&&result.comment_deadline_source_url!==NAMPA_COMMENT_RULES&&!stored?.comment_deadline_label)result.comment_deadline_label="Written comments";
  result.commentDeadline=result.comment_deadline;
  result.commentSourceUrl=result.comment_deadline_source_url;
  // A successful poll that found no published document must clear a stale feed link.
  const checked=stored?.match_status!==undefined;
  result.agenda_url=checked?stored.agenda_url:stored?.agenda_url??next.agenda_url??next.agendaUrl;
  result.packet_url=checked?stored.packet_url:stored?.packet_url??next.packet_url??next.packetUrl;
  result.agendaUrl=result.agenda_url;result.packetUrl=result.packet_url;
  result.meeting_datetime=stored?.meeting_datetime??next.startsAt;
  if(areaId==="nampa"&&result.meeting_kind==="special"&&!stored?.comment_deadline){
    delete result.comment_deadline;delete result.commentDeadline;delete result.comment_deadline_source_url;delete result.commentSourceUrl;delete result.speak_signup_url;
  }
  return result;
}
