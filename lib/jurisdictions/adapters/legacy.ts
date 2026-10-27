import type {HearingFeed} from "../../localities/types";
import type {JurisdictionDefinition} from "../types";
import type {AgendaAdapter,ApplicationAdapter,Meeting} from "./types";
/** Compatibility bridges preserve the collectors' full original output. Platform names
 * select established implementations; consumers never select a city-specific parser. */
export async function legacyFeed(config:JurisdictionDefinition):Promise<HearingFeed>{
 const platform=config.agenda[0].adapter;
 if(platform==="primegov")return(await import("../../localities/nampa")).getNampaHearings();
 if(platform==="municipalClerk")return(await import("../../localities/meridian")).getMeridianHearings();
 if(platform==="countyLandHearings")return(await import("../../localities/canyon-county")).getCanyonCountyHearings();
 const {MUNICIPAL_FEEDS}=await import("../../localities/municipal");
 const load=MUNICIPAL_FEEDS[config.id as keyof typeof MUNICIPAL_FEEDS];if(!load)throw Error("No legacy feed for this platform configuration");return load();
}
export function legacyAdapters(config:JurisdictionDefinition,load:()=>Promise<HearingFeed>):{agenda:AgendaAdapter;applications:ApplicationAdapter;feed:()=>Promise<HearingFeed>}{
 const meetings=async()=>{const feed=await load();return(feed.agendaMeetings??[]).map(m=>({id:m.id,title:m.title,body:m.body,date:m.date,meetingPageUrl:m.meetingUrl??m.sourceUrl,attachments:[],items:m.items.map(i=>({itemId:i.itemNumber??i.title,title:i.title,caseNumbers:i.caseIds,body:m.body,meetingDateTime:m.date,meetingPageUrl:m.meetingUrl??m.sourceUrl,attachments:[]}))} as Meeting));};
 return{feed:load,agenda:{listMeetings:async range=>(await meetings()).filter(m=>m.date>=range.start&&m.date<=range.end),getMeeting:async id=>{const m=(await meetings()).find(m=>m.id===id);if(!m)throw Error("Meeting not found");return m;},healthcheck:async()=>{await load();return[];}},applications:{listApplications:async()=>{const feed=await load();return [...feed.active,...feed.completed,...feed.upcomingOnly??[]].map(h=>({recordId:h.appId,relatedCaseNumbers:[h.appId],name:h.displayTitle??h.appScope??h.appId,type:h.appType,status:h.appStatus,address:"",parcel:[],description:h.description??h.summary??h.appScope??"",recordUrl:h.externalUrl??String(config.applications.params.url??config.agenda[0].params.baseUrl),sourceUrl:h.externalUrl??String(config.agenda[0].params.baseUrl),sourceFields:{}}));},getApplication:async id=>{const all=await legacyAdapters(config,load).applications.listApplications();return all.find(a=>a.recordId===id);},healthcheck:async()=>{await load();return[];}}};
}
