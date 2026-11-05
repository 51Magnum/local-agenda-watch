import {agendaAdapter} from "./adapters";
import {contentHash} from "./snapshot-hash";
import {SourceFailure,type SourceHttp} from "./http";
import type {DateRange,Meeting} from "./adapters/types";
import type {JurisdictionDefinition} from "./types";
export type AgendaProgress={key:string;startedAt:string;sources:Record<string,Record<string,{fingerprint:string;meeting:Meeting}>>};
export function agendaProgress(d:JurisdictionDefinition,range:DateRange,now:Date,previous?:AgendaProgress):AgendaProgress{
 const key=contentHash([d.id,range,d.agenda,d.hearingBodies,d.caseNumberPatterns,d.documents]);
 const age=now.getTime()-Date.parse(previous?.startedAt??"");
 return previous?.key===key&&age>=0&&age<2*3600000?previous:{key,startedAt:now.toISOString(),sources:{}};
}
/** A bounded private cycle: only successfully fetched meeting details can be reused. */
export async function collectAgendas(d:JurisdictionDefinition,range:DateRange,http:SourceHttp,deadline:number,progress:AgendaProgress,save:(p:AgendaProgress)=>Promise<void>=async()=>{}){
 const meetings:Meeting[]=[],pending:string[]=[],skipped:{url:string;reason:string}[]=[];
 let complete=true,dirty=0;
 const checkpoint=async()=>{await save(progress);dirty=0;};
 for(const source of d.agenda){
  const key=contentHash(source),done=progress.sources[key]??={};
  if(Date.now()>deadline-25000){complete=false;break;}
  const adapter=agendaAdapter(d,source,http);
  try{
   // Re-list each source to discover additions/removals and changed calendar metadata.
   const listed=await adapter.listMeetings(range),urls=new Set(listed.map(m=>m.meetingPageUrl));
   for(const url of Object.keys(done))if(!urls.has(url))delete done[url];
   const ordered=listed.sort((a,b)=>Number(!!done[a.meetingPageUrl])-Number(!!done[b.meetingPageUrl])||b.date.localeCompare(a.date));
   for(const [index,m] of ordered.entries()){
    const fingerprint=contentHash(m),cached=done[m.meetingPageUrl];
    if(cached?.fingerprint===fingerprint){meetings.push(structuredClone(cached.meeting));continue;}
    if(Date.now()>deadline-25000){complete=false;pending.push(...ordered.slice(index).filter(m=>!done[m.meetingPageUrl]||done[m.meetingPageUrl].fingerprint!==contentHash(m)).map(m=>m.meetingPageUrl));break;}
    try{const detail=await adapter.getMeeting(m.id);done[m.meetingPageUrl]={fingerprint,meeting:structuredClone(detail)};meetings.push(detail);dirty++;}
    catch(e){complete=false;pending.push(m.meetingPageUrl);if(!(e instanceof SourceFailure))skipped.push({url:m.meetingPageUrl,reason:String(e)});}
    if(dirty>=5)await checkpoint();
   }
  }catch(e){complete=false;if(!(e instanceof SourceFailure))skipped.push({url:String(source.params.baseUrl),reason:String(e)});}
  await checkpoint();
 }
 await checkpoint();
 return {complete,meetings,pendingMeetings:[...new Set(pending)],skipped,completedMeetings:Object.values(progress.sources).reduce((n,source)=>n+Object.keys(source).length,0)};
}
