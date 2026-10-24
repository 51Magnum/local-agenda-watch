import { unstable_cache } from "next/cache";
import { Pool } from "pg";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { canyonCounty, collectCountyEvents, composeCountyFeed, fetchCountyFeatures, countyFromFeature, type CountyCase, type CountyEvent } from "@/lib/sources/canyon-county";
import type { HearingFeed } from "./types";
let pool: Pool | undefined, initialized: Promise<unknown> | undefined;
function db() { pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});initialized??=pool.query("CREATE TABLE IF NOT EXISTS law_source_cache (area text PRIMARY KEY, snapshot jsonb NOT NULL)").catch(e=>{initialized=undefined;throw e;});return pool; }
const file=()=>path.join(process.cwd(),".data","canyon-county-feed.json");
async function readFeed():Promise<HearingFeed|undefined> {
 if(process.env.DATABASE_URL){const pool=db();await initialized;return(await pool.query("SELECT snapshot FROM law_source_cache WHERE area=$1",["canyon-county"])).rows[0]?.snapshot;}
 if(process.env.VERCEL)return;
 try{return JSON.parse(await readFile(file(),"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
}
async function saveFeed(feed:HearingFeed){
 if(process.env.DATABASE_URL){const pool=db();await initialized;await pool.query("INSERT INTO law_source_cache (area,snapshot) VALUES ($1,$2::jsonb) ON CONFLICT (area) DO UPDATE SET snapshot=excluded.snapshot",["canyon-county",JSON.stringify(feed)]);return;}
 if(process.env.VERCEL)return;
 await mkdir(path.dirname(file()),{recursive:true});const temp=file()+"."+randomUUID()+".tmp";await writeFile(temp,JSON.stringify(feed));await rename(temp,file());
}
export async function refreshCountyFeed():Promise<HearingFeed> {
 let previous:HearingFeed|undefined;
 try{previous=await readFeed();}catch{console.error("[canyon-county] Previous source snapshot unavailable");}
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
 try{await saveFeed(feed);}catch{console.error("[canyon-county] Source snapshot could not be saved");}
 return feed;
}
export const getCanyonCountyHearings=unstable_cache(refreshCountyFeed,["canyon-county:feed:v2"],{revalidate:3600,tags:["canyon-county:cases"]});
canyonCounty.getHearings=getCanyonCountyHearings;
export {canyonCounty,countyFromFeature};
