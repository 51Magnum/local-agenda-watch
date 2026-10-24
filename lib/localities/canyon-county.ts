import { unstable_cache } from "next/cache";
import {readSourceFeed,saveSourceFeed} from "./source-cache";
import { canyonCounty, collectCountyEvents, composeCountyFeed, fetchCountyFeatures, countyFromFeature, type CountyCase, type CountyEvent } from "@/lib/sources/canyon-county";
import type { HearingFeed } from "./types";
export async function refreshCountyFeed():Promise<HearingFeed> {
 let previous:HearingFeed|undefined;
 try{previous=await readSourceFeed("canyon-county");}catch{console.error("[canyon-county] Previous source snapshot unavailable");}
 const oldCases=[...(previous?.active??[]),...(previous?.completed??[])] as CountyCase[];
 const oldEvents=[...new Map(oldCases.flatMap(c=>c.county?.events??[]).map(e=>[e.id,e])).values()] as CountyEvent[];
 const [records,calendar]=await Promise.allSettled([fetchCountyFeatures(),collectCountyEvents(new Date(),oldEvents)]);
 let feed:HearingFeed;
 if(records.status==="fulfilled")feed=composeCountyFeed(records.value,calendar.status==="fulfilled"?calendar.value.events:oldEvents);
 else {
  console.error("[canyon-county] Case records unavailable; retaining last successful records");
  // Rebuild from prior attributes without dropping records when the GIS is offline.
  const features=oldCases.map(h=>({type:"Feature" as const,geometry:null,properties:{PermitNum:h.appId,AppType2:h.appTypeLabel,Description:h.description,ParcelAddress:h.county.address,Status:h.county.sourceStatus,ApprovalStatus:h.county.approvalStatus,AppSubmitted:h.county.appliedDate?Date.parse(h.county.appliedDate):null,DecisionDate:h.county.decisionDate?Date.parse(h.county.decisionDate):null}}));
  if(!features.length && (calendar.status!=="fulfilled" || (calendar.value.unavailable&&!calendar.value.events.length)))throw new Error("County sources unavailable");
  feed=composeCountyFeed(features,calendar.status==="fulfilled"?calendar.value.events:oldEvents);
  feed.refreshedAt=previous?.refreshedAt;
 }
 feed.dataUnavailable=records.status!=="fulfilled";
 feed.scheduleUnavailable=calendar.status!=="fulfilled"||calendar.value.unavailable;
 if(calendar.status==="rejected")console.error("[canyon-county] Hearing schedule unavailable");
 try{await saveSourceFeed("canyon-county",feed);}catch{console.error("[canyon-county] Source snapshot could not be saved");}
 return feed;
}
export const getCanyonCountyHearings=unstable_cache(refreshCountyFeed,["canyon-county:feed:v2"],{revalidate:3600,tags:["canyon-county:cases"]});
canyonCounty.getHearings=getCanyonCountyHearings;
export {canyonCounty,countyFromFeature};
