import {AREAS} from "@/lib/areas/registry";
import {CASE_EVIDENCE} from "@/lib/case-evidence";
import {getProjectForCase} from "@/lib/projects";
import {getJurisdiction} from "./jurisdictions";
import {getEvidenceStore,type EvidenceStore} from "@/lib/timeline/store";
import {emptyEvidenceState} from "@/lib/timeline/types";
import {recordDocuments} from "@/lib/timeline/discover-areas";
import {walkLibrary} from "@/lib/timeline/libraries";
import {allowedSource,sourceRequest} from "@/lib/timeline/source-access";
import {parsePrimeGovMeetings,parsePrimeGovAgenda,NAMPA_PRIMEGOV_ORIGIN} from "@/lib/sources/primegov";
import {allowedImageTitle,forbiddenImageDocument} from "./image-policy";
import type {Hearing,HearingFeed} from "@/lib/localities/types";
import type {ImageDocument,ImageJob} from "./image-job-store";
export type ImageDocumentContext={hearing:Hearing;feed?:HearingFeed;job:ImageJob;deadline:number;checkpoint:()=>Promise<void>};
export async function loadCaseDocuments(areaId:string,caseId:string,ctx:ImageDocumentContext){
 const config=getJurisdiction(areaId)!,area=AREAS[areaId],documents:ImageDocument[]=[...ctx.job.documents];let complete=true;
 const add=(d:ImageDocument)=>{if(areaId==="meridian"&&/packet/i.test(d.title+" "+d.url))d={...d,packet:true};try{const u=new URL(d.url),direct=u.searchParams.get("u");if(u.hostname==="meetings.municode.com"&&direct&&allowedSource(direct,areaId))d={...d,url:direct};}catch{}if(!forbiddenImageDocument.test(d.title)&&allowedSource(d.url,areaId)&&!documents.some(v=>v.url===d.url))documents.push(d);};
 for(const d of recordDocuments(area,ctx.hearing).filter(d=>d.content===undefined))add({title:d.title,url:d.url,packet:areaId==="meridian"&&/packet/i.test(d.title),date:ctx.hearing.meetings.find(m=>m.packetUrl===d.url)?.date});
 const evidence=CASE_EVIDENCE[caseId];if(areaId==="nampa"&&evidence?.reportUrl)add({url:evidence.reportUrl,title:evidence.documentNames[0]});
 for(const d of getProjectForCase(caseId,areaId)?.sourceDocuments??[])if(d.caseIds.includes(caseId))add({url:d.url,title:d.label});
 const store=getEvidenceStore();const state=store.readCase?await store.readCase(areaId,[caseId]):await store.read();
 for(const d of Object.values(state.documents))if(d.content===undefined&&d.kind!=="case-record"&&!/minutes|decision|findings/.test(d.kind)&&d.caseIds.includes(caseId))add({url:d.url,title:d.title,packet:areaId==="meridian"&&/packet/i.test(d.title)});
 // Folder traversal state belongs to the small image job, not the timeline JSON.
 const libraryState=emptyEvidenceState();libraryState.folderQueues=ctx.job.folders;
 const libraryStore:EvidenceStore={read:async()=>libraryState,mutate:async work=>{const result=work(libraryState);ctx.job.folders=libraryState.folderQueues??{};await ctx.checkpoint();return result;}};
 const roots=[ctx.hearing.externalUrl,...ctx.hearing.meetings.map(m=>m.agendaUrl)].filter((u):u is string=>Boolean(u&&/Browse\.aspx|sharepoint\.com|adaHtmlDocument/i.test(u)));
 const notices=(ctx.hearing as Hearing&{meridian?:{notices:{filesUrl?:string}[]}}).meridian?.notices??[];for(const n of notices)if(n.filesUrl)roots.push(n.filesUrl);
 for(const root of new Set(roots)){if(Date.now()>=ctx.deadline-12000){complete=false;break;}try{for(const d of await walkLibrary(areaId,caseId,root,libraryStore,Math.min(ctx.deadline,Date.now()+20000)))add(d);const queued=Object.values(ctx.job.folders).some(q=>q.length&&!(q.length===1&&q[0]===root));if(queued)complete=false;}catch(e){complete=false;ctx.job.errors.push(new URL(root).hostname+": "+(e instanceof Error?e.message:"unavailable"));}}
 if(areaId==="nampa"){
  if(ctx.hearing.energovPlanId&&config.recordClient){try{for(const f of await config.recordClient.getPlanAttachments(ctx.hearing.energovPlanId))if(!f.IsFileSecure&&(allowedImageTitle(f.FileName)||/staff[ _-]*report/i.test(f.FileName))&&!forbiddenImageDocument.test(f.FileName))add({url:config.recordClient.planPortalUrl(ctx.hearing.energovPlanId,"attachments")+"&attachmentId="+f.AttachmentID,title:f.FileName,attachmentId:f.AttachmentID,planId:ctx.hearing.energovPlanId});}catch(e){ctx.job.errors.push("EnerGov: "+(e instanceof Error?e.message:"blocked"));complete=false;}}
  try{
   const years=[...new Set([new Date().getUTCFullYear(),Number(caseId.slice(-4))])].filter(y=>y>=2023&&y<=new Date().getUTCFullYear());
   const lists=await Promise.all(years.map(async year=>parsePrimeGovMeetings(await(await sourceRequest(NAMPA_PRIMEGOV_ORIGIN+"/api/v2/PublicPortal/ListArchivedMeetings?year="+year,areaId)).json())));
   lists.push(parsePrimeGovMeetings(await(await sourceRequest(NAMPA_PRIMEGOV_ORIGIN+"/api/v2/PublicPortal/ListUpcomingMeetings",areaId)).json()));
   const meetings=[...new Map(lists.flat().map(m=>[m.id,m])).values()].filter(m=>m.htmlAgendaUrl).sort((a,b)=>b.date.localeCompare(a.date));
   let cursor=ctx.job.discoveryCursor??0;
   while(cursor<meetings.length&&Date.now()<ctx.deadline-12000){const batch=meetings.slice(cursor,cursor+6);await Promise.all(batch.map(async m=>{try{const html=await(await sourceRequest(m.htmlAgendaUrl!,areaId)).text();for(const item of parsePrimeGovAgenda(html,m.htmlAgendaUrl!))if(item.caseIds.includes(caseId))for(const d of item.staffReports)add({title:d.label,url:d.url,date:m.date});}catch(e){ctx.job.errors.push("PrimeGov agenda: "+(e instanceof Error?e.message:"blocked"));}}));cursor+=batch.length;ctx.job.discoveryCursor=cursor;ctx.job.documents=documents;await ctx.checkpoint();}
   if(cursor<meetings.length)complete=false;else ctx.job.discoveryCursor=0;
  }catch(e){complete=false;ctx.job.errors.push("PrimeGov: "+(e instanceof Error?e.message:"blocked"));}
 }
 return {documents,complete};
}
