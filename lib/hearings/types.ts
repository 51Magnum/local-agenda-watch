/** Additive fields shared by the public upcoming hearing, persisted match, and email. */
export type HearingMeetingFields = {
  meeting_url?: string;
  agenda_url?: string;
  packet_url?: string;
  meeting_body?: string;
  meeting_datetime?: string;
  agenda_item_number?: string;
  comment_deadline?: string;
  comment_deadline_source_url?: string;
  comment_deadline_label?: string;
  speak_signup_url?: string;
  last_checked_at?: string;
  agenda_expected_at?: string;
  agenda_expected_source_url?: string;
  agenda_expected_note?: string;
  staff_report_deadline?: string;
  staff_report_deadline_source_url?: string;
  comment_email?: string;
  testimony_source_url?: string;
  testimony_rules?: string;
  testimony_source_label?: string;
  speak_signup_note?: string;
  meeting_kind?: "regular" | "special";
  time_subject_to_change?: boolean;
  match_status?: "awaiting-agenda" | "published";
};
export type HearingTarget = { areaId: string; caseId: string; caseIds: string[]; startsAt: string; body: string; timezone: string; commentDeadline?:string;commentSourceUrl?:string };
export type HearingMatchRow = {
  areaId: string; caseId: string; hearingKey: string;
  data: HearingMeetingFields;
  override: Partial<Record<keyof HearingMeetingFields, string | boolean | null>>;
  failureCount: number; lastAttemptAt?: string; nextAttemptAt?: string; lastError?: string;
};
export function localHearingDate(value: string, timezone="America/Denver") {
  return value.length===10 ? value : new Intl.DateTimeFormat("en-CA",{timeZone:timezone}).format(new Date(value));
}
export function hearingBody(value: string) {
  return /planning|p&z/i.test(value) ? "P&Z" : /city council/i.test(value) ? "City Council" : value;
}
export function hearingKey(target: Pick<HearingTarget,"body"|"startsAt"|"timezone">) {
  return hearingBody(target.body)+":"+localHearingDate(target.startsAt,target.timezone);
}
