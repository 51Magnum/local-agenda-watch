import type {AreaDefinition} from "@/lib/areas/registry";
import type {HearingFeed} from "@/lib/localities/types";
import type {EvidenceState} from "./types";

export type MeetingWatch={id:string;areaId:string;body:string;date:string;caseIds:string[];resolvedCaseIds:string[];lastChecked?:string};
export type ScheduleState={recordChecks?:Record<string,Record<string,string>>;version:1;meetings:MeetingWatch[];slots:Record<string,string>;updatedAt?:string;sweeps?:Record<string,{lastAttemptAt:string;lastSuccessAt?:string;cases:number;documents:number;warning?:string}>};
export type SchedulePlan={slot:string;modes:string[];meetingIds:string[];caseIdsByArea?:Record<string,string[]>;recheckCaseIdsByArea:Record<string,string[]>;fullSweep:boolean};
export const emptySchedule=():ScheduleState=>({version:1,meetings:[],slots:{}});
export function localClock(now:Date,timezone="America/Denver"){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(now);
 const value=(type:string)=>parts.find(p=>p.type===type)!.value;
 return {date:`${value("year")}-${value("month")}-${value("day")}`,hour:Number(value("hour"))};
}
const days=(a:string,b:string)=>Math.round((Date.parse(a)-Date.parse(b))/86400000);
/** Delayed Actions runs share one durable AM/PM slot throughout each local-time window. */
export function schedulerWindow(now:Date,manual=false){const {date,hour}=localClock(now);return manual?{date,period:hour<14?"am":"pm"}:hour>=5&&hour<10?{date,period:"am"}:hour>=14&&hour<19?{date,period:"pm"}:null;}
export function planSchedule(state:ScheduleState,areas:Record<string,AreaDefinition>,now=new Date(),{manual=false,force=false}:{manual?:boolean;force?:boolean}={}):SchedulePlan|null{
 const window=schedulerWindow(now,manual);if(!window&&!force)return null;
 const slot=force?`manual:${now.toISOString()}`:`${window!.date}:${window!.period}`;
 if(!force&&state.slots[slot])return null;
 const fullSweep=force||window?.period==="am";
 const modes=fullSweep?[force?"forced-full-sweep":"daily-sweep"]:[];
 const selected=new Map<string,Set<string>>(),meetingIds:string[]=[];
 for(const meeting of state.meetings){
  const area=areas[meeting.areaId];if(!area||area.status!=="live"||!area.timeline)continue;
  const today=localClock(now,area.timezone).date,age=days(today,meeting.date);
  const remaining=meeting.caseIds.filter(id=>!meeting.resolvedCaseIds.includes(id));
  const pre=age===-1&&window?.period==="pm";
  const post=remaining.length>0&&(age===1||(age>=2&&age<=14&&window?.period==="am")||(age>14&&window?.period==="am"&&(!meeting.lastChecked||days(today,meeting.lastChecked)>=7)));
  if(!pre&&!post)continue;
  const mode=pre?"pre-hearing":"post-meeting";if(!modes.includes(mode))modes.push(mode);
  meetingIds.push(meeting.id);const ids=selected.get(area.id)??new Set<string>();for(const id of pre?meeting.caseIds:remaining)ids.add(id);selected.set(area.id,ids);
 }
 if(!modes.length)return null;
 const recheckCaseIdsByArea=Object.fromEntries([...selected].map(([id,ids])=>[id,[...ids]]));
 return {slot,modes,meetingIds,fullSweep,recheckCaseIdsByArea,...(!fullSweep?{caseIdsByArea:recheckCaseIdsByArea}:{})};
}
/** Keep associations even when a portal removes a past meeting from its next feed. */
export function mergeMeetingIndex(state:ScheduleState,feeds:Record<string,HearingFeed>,areas:Record<string,AreaDefinition>){
 const meetings=new Map(state.meetings.map(m=>[m.id,m]));
 for(const [areaId,feed]of Object.entries(feeds)){
  const area=areas[areaId];if(!area)continue;
  const bodies=new Set([area.bodies.planning.id,area.bodies.decision.id,...(area.bodies.additional??[]).map(b=>b.id)]);
  const add=(body:string,date:string,ids:string[])=>{
   if(!bodies.has(body)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!ids.length)return;
   const id=[areaId,body,date].join(":"),old=meetings.get(id);
   meetings.set(id,{id,areaId,body,date,caseIds:[...new Set([...(old?.caseIds??[]),...ids])],resolvedCaseIds:old?.resolvedCaseIds??[],lastChecked:old?.lastChecked});
  };
  for(const h of [...feed.active,...feed.completed,...(feed.upcomingOnly??[])])for(const m of h.meetings)add(m.body,m.date,[h.appId]);
  for(const m of feed.agendaMeetings??[])add(m.body,m.date,m.items.flatMap(i=>i.caseIds));
 }
 return [...meetings.values()];
}
/** A document must identify this hearing's date; an older decision must never stop follow-up. Pending review stays private. */
export function resolvedMeetingCases(meeting:MeetingWatch,evidence:EvidenceState,area:AreaDefinition){
 const decisionBody=meeting.body===area.bodies.decision.id;
 return meeting.caseIds.filter(caseId=>Object.values(evidence.documents).some(doc=>{
  if((doc.areaId??"nampa")!==area.id||doc.state!=="complete"||!doc.caseIds.includes(caseId)||!(decisionBody?["council-decision","findings","minutes"]:["pz-decision","findings","minutes"]).includes(doc.kind))return false;
  const fields=Object.values(evidence.fields).filter(f=>f.documentId===doc.id&&f.documentHash===doc.hash&&f.caseId===caseId&&f.status!=="rejected");
  return fields.some(f=>f.key===(decisionBody?"councilDecision":"pzResult")&&Boolean(f.value))&&fields.some(f=>(f.key===(decisionBody?"councilHearingDate":"pzHearingDate")||decisionBody&&f.key==="decisionDate")&&f.value.slice(0,10)===meeting.date);
 }));
}
export function finishSchedule(state:ScheduleState,plan:SchedulePlan,feeds:Record<string,HearingFeed>,evidence:EvidenceState,areas:Record<string,AreaDefinition>,now=new Date(),checkedCases:Record<string,string[]>={}){
 const meetings=mergeMeetingIndex(state,feeds,areas).map(m=>({...m,resolvedCaseIds:areas[m.areaId]?resolvedMeetingCases(m,evidence,areas[m.areaId]):m.resolvedCaseIds,
  // Only count a follow-up when every unresolved case had a fresh case/document discovery pass.
  lastChecked:m.lastChecked}));
 for(const m of meetings)if(plan.meetingIds.includes(m.id)){
  const checked=m.caseIds.filter(id=>!m.resolvedCaseIds.includes(id)).every(id=>checkedCases[m.areaId]?.includes(id));
  if(checked)m.lastChecked=localClock(now,areas[m.areaId].timezone).date;
 }
 const recordChecks=structuredClone(state.recordChecks??{});
 for(const [areaId,ids]of Object.entries(checkedCases))for(const id of ids)(recordChecks[areaId]??={})[id]=now.toISOString();
 const sweeps={...state.sweeps};
 if(plan.fullSweep)for(const area of Object.values(areas).filter(a=>a.status==="live"&&a.timeline)){
  const feed=feeds[area.id],success=Boolean(feed&&!feed.dataUnavailable&&!feed.scheduleUnavailable);
  sweeps[area.id]={lastAttemptAt:now.toISOString(),lastSuccessAt:success?now.toISOString():sweeps[area.id]?.lastSuccessAt,cases:feed?new Set([...feed.active,...feed.completed,...(feed.upcomingOnly??[])].map(h=>h.appId)).size:0,documents:Object.values(evidence.documents).filter(d=>(d.areaId??"nampa")===area.id).length,...(!success?{warning:"Source sweep was incomplete or a source was unavailable; last success retained."}:{})};
 }
 return {version:1 as const,recordChecks,sweeps,meetings,slots:Object.fromEntries(Object.entries({...state.slots,[plan.slot]:now.toISOString()}).slice(-40)),updatedAt:now.toISOString()};
}
