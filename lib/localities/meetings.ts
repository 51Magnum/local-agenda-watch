import { latestCouncilDecision } from "./stages";
import type { Hearing, HearingFeed } from "./types";

/**
 * One public-hearing meeting with the hearings scheduled to appear before it.
 * Inverts the per-Hearing `meetings[]` relation so the hub / meeting-index
 * routes can iterate by meeting rather than by application.
 */
export type UpcomingMeeting = {
  title?: string;
  agendaUrl?: string;
  packetUrl?: string;
  timeLabel?: string;
  location?: string;
  /** Canonical body identifier, e.g. "P&Z" or "City Council". */
  body: string;
  /** Human label for the body, e.g. "Planning & Zoning Commission". */
  bodyLabel: string;
  /** ISO date (YYYY-MM-DD) the meeting is scheduled for. */
  date: string;
  /** Human-facing date label, e.g. "April 28, 2026". */
  dateLabel: string;
  /** Source URL where this schedule was published. */
  sourceUrl: string;
  /** Applications scheduled for this meeting that were not continued away. */
  hearings: Hearing[];
};

function todayIso(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Invert a locality's active hearings into a chronologically-ordered list of
 * upcoming public-hearing meetings.
 *
 * Rules:
 *  - `feed.active` and `feed.upcomingOnly` are both walked; completed cases
 *    are not surfaced as "upcoming".
 *  - Meetings whose date is strictly before today are dropped.
 *  - Scheduled entries carrying a `continuedNote` are dropped: the city
 *    republishes the item against its new date, so we keep the fresh entry
 *    and skip the one it was continued away from.
 *  - Hearings that land on the same `(body, date)` are grouped, preserving
 *    feed order within the group.
 */
export function getUpcomingMeetings(
  feed: HearingFeed,
  options: { limit?: number; now?: Date } = {},
): UpcomingMeeting[] {
  const { limit, now = new Date() } = options;
  const cutoff = todayIso(now);

  const groups = new Map<string, UpcomingMeeting>();
  for (const m of feed.agendaMeetings ?? []) {
    if (m.date < cutoff) continue;
    const key = m.body + "|" + m.date;
    if (!groups.has(key)) groups.set(key, {
      body: m.body, bodyLabel: m.bodyLabel, date: m.date, dateLabel: m.dateLabel,
      title: m.title, sourceUrl: m.sourceUrl, agendaUrl: m.agendaUrl,
      packetUrl: m.packetUrl, timeLabel: m.timeLabel, location: m.location,
      hearings: [],
    });
  }
  const sources = [...feed.active, ...(feed.upcomingOnly ?? [])];
  for (const hearing of sources) {
    if (hearing.decisionRecorded || latestCouncilDecision(hearing)) continue;
    for (const m of hearing.meetings) {
      if (m.continuedNote != null) continue;
      if (m.date < cutoff) continue;
      const key = `${m.body}|${m.date}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          body: m.body,
          bodyLabel: m.bodyLabel,
          date: m.date,
          dateLabel: m.dateLabel,
          sourceUrl: m.sourceUrl,
          agendaUrl: m.agendaUrl,
          packetUrl: m.packetUrl,
          location: m.location,
          hearings: [],
        };
        groups.set(key, group);
      }
      group.agendaUrl ??= m.agendaUrl;
      group.packetUrl ??= m.packetUrl;
      if (!group.hearings.some((h) => h.appId === hearing.appId)) group.hearings.push(hearing);
    }
  }

  const out = Array.from(groups.values()).filter((m) => m.hearings.length > 0 || (!/attendance notice|state of the city|ceremony|reception/i.test(m.title ?? "") && (m.body === "P&Z" || m.body === "Arts & Historic Preservation" || /land[\s-]*use|annexation|rezone|rezoning|subdivision|zoning/i.test(m.title ?? "")))).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return limit != null ? out.slice(0, limit) : out;
}
