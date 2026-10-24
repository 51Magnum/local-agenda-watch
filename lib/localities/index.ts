import { caseCatalog } from "@/lib/case-catalog";
import { nampa } from "./nampa";
import { canyonCounty } from "./canyon-county";
import type { Hearing, HearingFeed, Locality } from "./types";

export type {
  Hearing,
  HearingFeed,
  HearingPhase,
  Locality,
  ScheduledMeeting,
  TrackedItem,
} from "./types";
export { getUpcomingMeetings, type UpcomingMeeting } from "./meetings";

const LOCALITIES: Record<string, Locality> = {
  [nampa.slug]: nampa,
  [canyonCounty.slug]: canyonCounty,
};

export function getLocality(slug: string): Locality | null {
  return LOCALITIES[slug] ?? null;
}

export function listLocalities(): Locality[] {
  return Object.values(LOCALITIES);
}

/** Look up a hearing within a pre-fetched feed by its APPID. Case-insensitive. */
export function findHearing(
  hearings: Hearing[],
  appId: string
): Hearing | null {
  const needle = appId.toUpperCase();
  return hearings.find((h) => h.appId.toUpperCase() === needle) ?? null;
}

/** Count every unique case shown in the catalog, plus unfiled editorial items. */
export function getTrackedCaseCount(locality: Locality, feed?: HearingFeed): number {
  const ids = new Set(caseCatalog(feed).map((h) => h.appId.toUpperCase()));
  for (const item of locality.tracked) {
    for (const id of item.caseIds ?? ["editorial:" + item.slug]) {
      ids.add(id.toUpperCase());
    }
  }
  return ids.size;
}
