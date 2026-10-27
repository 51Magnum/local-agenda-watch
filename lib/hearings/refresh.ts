import { caseCatalog } from "../case-catalog";
import { getCaseNextHearing } from "../case-details";
import { AREAS } from "../areas/registry";
import type { HearingFeed } from "../localities/types";
import { getProjectNextHearing, projects } from "../projects";
import { primeGovAdapter, type HearingMeetingAdapter } from "./primegov";
import { enrichHearing } from "./policies";
import { readHearingMatch, saveHearingMatch } from "./store";
import { hearingKey, localHearingDate, type HearingMatchRow, type HearingTarget, type HearingMeetingFields } from "./types";

// TODO: implement a case/date/body matcher for each platform. Until then, use only
// official agenda/packet URLs already present in those jurisdictions' feeds.
export const hearingAdapters:Record<string,(()=>HearingMeetingAdapter)|undefined>={
  nampa:primeGovAdapter,
  meridian:undefined, // TODO: Municode meeting and case-item adapter.
  "canyon-county":undefined, // TODO: County published hearing-record adapter.
  kuna:undefined, // TODO: CivicPlus archive/agenda adapter.
  eagle:undefined, // TODO: Granicus meeting adapter.
  star:undefined, // TODO: Star meeting archive adapter.
  middleton:undefined, // TODO: Middleton published meeting/notices adapter.
};
export type HearingMatchStore={read:typeof readHearingMatch;save:typeof saveHearingMatch};
/** One API poll per platform/run; documents are shared across all joint case IDs. */
export async function refreshHearingMeetings(feeds:Record<string,HearingFeed>,options:{now?:Date;deadline?:number;store?:HearingMatchStore;adapters?:typeof hearingAdapters}={}) {
  const now=options.now??new Date(),deadline=options.deadline??Date.now()+45000,store=options.store??{read:readHearingMatch,save:saveHearingMatch};
  const counts={checked:0,published:0,failed:0,stopped:0,deferred:0};
  for(const [areaId,feed]of Object.entries(feeds)){
    const create=(options.adapters??hearingAdapters)[areaId],area=AREAS[areaId];if(!create||!area)continue;
    const targets=new Map<string,HearingTarget>();
    const add=(caseId:string,caseIds:string[],next:ReturnType<typeof getCaseNextHearing>)=>{
      if(!next)return;
      const day=localHearingDate(next.startsAt,area.timezone),today=localHearingDate(now.toISOString(),area.timezone);
      const days=(Date.parse(day+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000;
      if(days<0)return;
      const target={areaId,caseId,caseIds,startsAt:next.startsAt,body:next.body,timezone:area.timezone,commentDeadline:next.commentDeadline,commentSourceUrl:next.commentSourceUrl};targets.set(caseId+hearingKey(target),target);
    };
    for(const h of caseCatalog(feed))add(h.appId,[h.appId],getCaseNextHearing(h,feed,now,areaId));
    for(const project of projects.filter(p=>(p.areaId??"nampa")===areaId))for(const caseId of project.caseIds)add(caseId,project.caseIds,getProjectNextHearing(project,feed,now));
    const eligible:{target:HearingTarget;row:HearingMatchRow}[]=[];
    for(const target of targets.values()){
      const key=hearingKey(target),old=await store.read(areaId,target.caseId,key);
      if(old&&(old.failureCount>=3||old.nextAttemptAt&&Date.parse(old.nextAttemptAt)>now.getTime())){counts.stopped++;continue;}
      eligible.push({target,row:old??{areaId,caseId:target.caseId,hearingKey:key,data:{},override:{},failureCount:0}});
    }
    if(!eligible.length)continue;
    eligible.sort((a,b)=>(a.row.lastAttemptAt??"").localeCompare(b.row.lastAttemptAt??""));
    if(Date.now()>=deadline){counts.deferred+=eligible.length;continue;}
    const adapter=create();let meetings:Awaited<ReturnType<HearingMeetingAdapter["load"]>>=[],loadFailed=false;
    try{meetings=await adapter.load();}catch{loadFailed=true;}
    for(const {target,row}of eligible){
      if(Date.now()>=deadline){counts.deferred++;continue;}
      const attempt={...row,lastAttemptAt:now.toISOString()};
      try{
        if(loadFailed)throw Error("Official meeting feed unavailable");
        const matched=await adapter.match(target,meetings);
        const data=enrichHearing(areaId,{startsAt:target.startsAt,body:target.body,location:"",sourceUrl:"",commentDeadline:target.commentDeadline,commentSourceUrl:target.commentSourceUrl,...matched});
        // Persist only the additive meeting fields, not the original project record.
        const legacy=["startsAt","body","location","sourceUrl","commentDeadline","commentSourceUrl","agendaUrl","packetUrl"];
        const fields=Object.fromEntries(Object.entries(data).filter(([name])=>!legacy.includes(name))) as HearingMeetingFields;
        await store.save({...attempt,data:{...fields,last_checked_at:now.toISOString()},failureCount:0,nextAttemptAt:undefined,lastError:undefined});
        counts.checked++;if(fields.match_status==="published")counts.published++;
      }catch{
        const failureCount=Math.min(3,row.failureCount+1);
        await store.save({...attempt,failureCount,nextAttemptAt:failureCount<3?new Date(now.getTime()+Math.pow(2,failureCount-1)*3600000).toISOString():undefined,lastError:loadFailed?"Official meeting feed unavailable":"Meeting or agenda could not be verified; previous verified links retained"});
        counts.failed++;
      }
    }
  }
  console.info("[hearing-links:sweep]",JSON.stringify(counts));return counts;
}
