import type { Hearing, HearingFeed } from "./localities/types";

import { scheduledContinuations } from "./continuances";

/** Only explicit source relationships; never match project names or nearby parcels. */

export function relatedHearingIds(h: Hearing): string[] {

  const extra = h as Hearing & {municipal?: {relatedIds?: string[]}; relatedCaseIds?: string[]};

  return [...new Set([h.appId,...(extra.municipal?.relatedIds ?? []),...(extra.relatedCaseIds ?? [])])];

}

export function withRelatedHearings(hearing: Hearing, feed?: HearingFeed): Hearing {

  const catalog = [...(feed?.active??[]),...(feed?.completed??[]),...(feed?.upcomingOnly??[])];

  const ids = new Set(relatedHearingIds(hearing));

  let changed = true;

  while (changed) { changed = false; for (const h of catalog) if (relatedHearingIds(h).some(id=>ids.has(id))) for (const id of relatedHearingIds(h)) if (!ids.has(id)) { ids.add(id); changed = true; } }

  return {...hearing, relatedCaseIds:[...ids], meetings:scheduledContinuations([hearing,...catalog.filter(h=>h.appId!==hearing.appId&&ids.has(h.appId))].flatMap(h=>h.meetings))};

}
