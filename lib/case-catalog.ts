import type { Hearing, HearingFeed } from "./localities/types";

/** The same complete, deduplicated catalog powers browsing, counts and sitemap. */
export function caseCatalog(feed?: HearingFeed): Hearing[] {
  const cases = new Map<string, Hearing>();
  for (const hearing of [...(feed?.active ?? []), ...(feed?.upcomingOnly ?? []), ...(feed?.completed ?? []).map((h) => ({ ...h, decisionRecorded: true }))]) {
    const id = hearing.appId.toUpperCase();
    const previous = cases.get(id);
    cases.set(id, previous ? { ...previous, ...hearing, meetings: [...new Map([...previous.meetings, ...hearing.meetings].map((m) => [m.body + m.date, m])).values()] } : hearing);
  }
  return [...cases.values()];
}
