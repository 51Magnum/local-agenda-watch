/** Resident state is derived; raw official status stays available for material diffs. */
export type CaseState = "upcoming_hearing" | "hearing_passed_decision_pending" | "approved" | "denied" | "withdrawn" | "closed" | "under_review";
export const denverDay = (now = new Date()) => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Denver"}).format(now);
export function isFutureHearing(value: string, now = new Date()) {
  return value.length === 10 ? value >= denverDay(now) : Number.isFinite(Date.parse(value)) && Date.parse(value) > now.getTime();
}
export function terminalCaseState(status = ""): CaseState | undefined {
  const s = status.trim();
  if (/^(?:approved|approval granted|project entitled)\b/i.test(s)) return "approved";
  if (/^denied\b/i.test(s)) return "denied";
  if (/^(?:withdrawn|cancelled|canceled)\b/i.test(s)) return "withdrawn";
  if (/^(?:closed|complete|completed|decided|recorded)\b/i.test(s)) return "closed";
}
export function normalizeCaseState(status: string, next?: string, lastHearing?: string, now = new Date()): CaseState {
  return terminalCaseState(status) ?? (next && isFutureHearing(next,now) ? "upcoming_hearing" : lastHearing && !isFutureHearing(lastHearing,now) ? "hearing_passed_decision_pending" : "under_review");
}
export const caseStateLabel = (state: CaseState) => ({upcoming_hearing:"Upcoming hearing",hearing_passed_decision_pending:"Hearing passed; decision not yet recorded",approved:"Approved",denied:"Denied",withdrawn:"Withdrawn",closed:"Closed",under_review:"Under review"})[state];
