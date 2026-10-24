import {unstable_cache}from "next/cache";
import {geoQuery}from "@/lib/maps/gis";
import {readSourceFeed,saveSourceFeed}from "./source-cache";
import {composeMeridianFeed,meridianHtml,parseMeridianNotices,parseMeridianMeetings,parseMeridianAgenda,MERIDIAN_CASES,MERIDIAN_WHERE,MERIDIAN_NOTICES,MERIDIAN_PORTALS,type MeridianCase,type MeridianNotice}from "@/lib/sources/meridian";
import initialNotices from "@/lib/sources/snapshots/meridian-notices.json";
import type {Locality,AgendaMeeting}from "./types";
export async function refreshMeridianFeed(){
 const previous=await readSourceFeed("meridian").catch(()=>undefined),oldCases=[...(previous?.active??[]),...(previous?.completed??[])] as MeridianCase[];
 const oldNotices=[...new Map(oldCases.flatMap(h=>h.meridian.notices).map(n=>[n.caseIds.join(",")+n.body+n.date,n])).values()];
 let notices:MeridianNotice[]=!oldNotices.length||!previous?.scheduleRefreshedAt||previous.scheduleRefreshedAt<=initialNotices.checkedAt?initialNotices.notices:oldNotices,scheduleUnavailable=false,agendaUnavailable=false;
 const [records,noticeResult,indexes]=await Promise.allSettled([geoQuery(MERIDIAN_CASES,{where:MERIDIAN_WHERE,returnGeometry:"false"}),meridianHtml(MERIDIAN_NOTICES),Promise.allSettled(Object.entries(MERIDIAN_PORTALS).map(async([body,url])=>parseMeridianMeetings(await meridianHtml(url),body,url)))]);
 if(noticeResult.status==="fulfilled"){try{notices=parseMeridianNotices(noticeResult.value);}catch{scheduleUnavailable=true;}}else scheduleUnavailable=true;
 if(scheduleUnavailable)console.error("[meridian] Hearing notices unavailable; retaining last verified notices");
 const meetings:AgendaMeeting[]=[];
 if(indexes.status==="fulfilled")for(const result of indexes.value){if(result.status==="fulfilled")meetings.push(...result.value);else agendaUnavailable=true;}else agendaUnavailable=true;
 const deadline=Date.now()+25000;
 for(let i=0;i<meetings.length;i+=6){if(Date.now()>=deadline){agendaUnavailable=true;break;}await Promise.all(meetings.slice(i,i+6).map(async m=>{if(!m.htmlAgendaUrl)return;try{m.items=parseMeridianAgenda(await meridianHtml(m.htmlAgendaUrl),m.htmlAgendaUrl);}catch{agendaUnavailable=true;const old=previous?.agendaMeetings?.find(p=>p.id===m.id);if(old)m.items=old.items;}}));}
 // Keep previous body records during a partial archive outage.
 if(agendaUnavailable){console.error("[meridian] Some meeting records unavailable; preserving cached records");for(const old of previous?.agendaMeetings??[])if(!meetings.some(m=>m.id===old.id))meetings.push(old);}
 const features=records.status==="fulfilled"?records.value.features:oldCases.map(h=>({properties:h.meridian.attributes}));
 if(records.status==="rejected")console.error("[meridian] GIS case source unavailable; retaining prior records");
 if(!features.length&&records.status==="rejected"&&!notices.length)throw new Error("Meridian sources unavailable");
 const feed=composeMeridianFeed(features,notices,meetings);
 feed.scheduleUnavailable=scheduleUnavailable||agendaUnavailable;feed.dataUnavailable=records.status==="rejected";
 feed.scheduleRefreshedAt=scheduleUnavailable?(previous?.scheduleRefreshedAt??initialNotices.checkedAt):new Date().toISOString();
 try{await saveSourceFeed("meridian",feed);}catch{console.error("[meridian] Source snapshot could not be saved");}
 return feed;
}
export const getMeridianHearings=unstable_cache(refreshMeridianFeed,["meridian:feed:v2"],{revalidate:3600,tags:["meridian:cases"]});
export const meridian:Locality={slug:"meridian",displayName:"Meridian",fullName:"Meridian, Idaho",portalUrl:MERIDIAN_NOTICES,dataAttribution:"City of Meridian GIS, hearing notices and official meeting archive",tracked:[],getHearings:getMeridianHearings};
