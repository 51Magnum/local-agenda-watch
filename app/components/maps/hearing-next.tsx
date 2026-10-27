import type { ProjectHearing } from "@/lib/projects";
import { hearingDateTime } from "@/lib/areas/format";
import { hearingDeadlines, meetingAction, publicMeetingUrl } from "@/lib/hearings/presentation";
type Props={next:ProjectHearing&{role:string};timezone:string};
export default function HearingNext({next,timezone}:Props) {
  const action=meetingAction(next),deadlines=hearingDeadlines(next),expectedSource=publicMeetingUrl(next.agenda_expected_source_url);
  const day=(value:string)=>new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric",timeZone:timezone}).format(new Date(value));
  return <div className="law-hearing-details">
    <strong>{next.meeting_body??next.body}</strong>
    <p>{hearingDateTime(next.meeting_datetime??next.startsAt,timezone)}{next.time_subject_to_change?" · Subject to change":""}</p>
    {next.location&&!/^Location not confirmed/i.test(next.location)&&<p>{next.location}</p>}
    <small>{next.role}</small>
    {next.agenda_item_number&&<p><strong>Agenda item {next.agenda_item_number}</strong></p>}
    {action.url&&<a className="law-meeting-primary" href={action.url} target="_blank" rel="noreferrer">{action.label} ↗</a>}
    {action.packet&&<p><a className="law-meeting-secondary" href={action.packet} target="_blank" rel="noreferrer">Staff report / packet ↗</a></p>}
    {!action.agendaPublished&&next.agenda_expected_at&&expectedSource&&<p className="law-agenda-expected">Agenda expected about {day(next.agenda_expected_at)}. {next.agenda_expected_note} <a href={expectedSource} target="_blank" rel="noreferrer">Posting guidance</a></p>}
    {deadlines.map(deadline=><div key={deadline.label} className="law-hearing-deadline"><strong>{deadline.label}</strong><p>{hearingDateTime(deadline.at,timezone)}</p>{deadline.email&&<p>Email <a href={"mailto:"+deadline.email}>{deadline.email}</a>.</p>}<a href={deadline.source} target="_blank" rel="noreferrer">Deadline source ↗</a></div>)}
    {publicMeetingUrl(next.speak_signup_url)&&<p><a className="law-meeting-secondary" href={next.speak_signup_url} target="_blank" rel="noreferrer">Speaker sign-up / meeting participation ↗</a>{next.speak_signup_note&&<small> {next.speak_signup_note}</small>}</p>}
    {publicMeetingUrl(next.testimony_source_url)&&next.testimony_rules&&<details className="law-speaking-times"><summary>Speaking time limits</summary><p>{next.testimony_rules}</p><a href={next.testimony_source_url} target="_blank" rel="noreferrer">{next.testimony_source_label??"Speaking rules"} ↗</a></details>}
    {next.last_checked_at&&<small>Meeting links checked {hearingDateTime(next.last_checked_at,timezone)}</small>}
  </div>;
}
