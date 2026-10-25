export function participationClosed(item: { stage?: string; recordStatus?: string; appStatus?: string; decisionRecorded?: boolean }) {
  return ["Decided", "Recorded"].includes(item.stage ?? "") || item.decisionRecorded === true || /^(?:withdrawn|denied|approved|cancelled|canceled)\b/i.test(item.recordStatus ?? item.appStatus ?? "");
}
export function expiredCommentDeadline(deadline: string | undefined, hearing: string | undefined, body: string, timezone: string, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  if (!deadline || !hearing || deadline.slice(0,10) >= today || hearing.slice(0,10) < today) return;
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(deadline.slice(0,10) + "T12:00:00Z"));
  return `The posted comment deadline (${date}) has passed. Contact ${body} staff about commenting on the continued hearing.`;
}
