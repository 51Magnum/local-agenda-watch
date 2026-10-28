import {publicJurisdictions,jurisdiction} from "../jurisdictions/registry";
import {configuredLocality} from "../jurisdictions/runtime";
import {MUNICIPAL_LOCALITIES} from "./municipal";
import { caseCatalog } from "@/lib/case-catalog";
import { nampa } from "./nampa";
import { meridian } from "./meridian";
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

const providers:Record<string,Locality>={primegov:nampa,municipalClerk:meridian,countyLandHearings:canyonCounty,...Object.fromEntries(Object.entries(MUNICIPAL_LOCALITIES).map(([id,l])=>[jurisdiction(id).agenda[0].adapter,l]))};
const LOCALITIES:Record<string,Locality>=Object.fromEntries(publicJurisdictions().map(d=>[d.id,d.legacyPublic?providers[d.agenda[0].adapter]:configuredLocality(d.id)]));

export function getLocality(slug:string):Locality|null {return LOCALITIES[slug]??null;}
export function listLocalities():Locality[]{return Object.values(LOCALITIES);}
export function findHearing(hearings:Hearing[],appId:string):Hearing|null {const needle=appId.toUpperCase();return hearings.find(h=>h.appId.toUpperCase()===needle)??null;}
export function getTrackedCaseCount(locality:Locality,feed?:HearingFeed):number {
 const ids=new Set(caseCatalog(feed).map(h=>h.appId.toUpperCase()));
 for(const item of locality.tracked)for(const id of item.caseIds??["editorial:"+item.slug])ids.add(id.toUpperCase());
 return ids.size;
}
