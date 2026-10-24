import { AREAS, type AreaDefinition } from "@/lib/areas/registry";
import { getLocality } from "@/lib/localities";
import type { Hearing,HearingFeed } from "@/lib/localities/types";
import type { CountyCase } from "@/lib/sources/canyon-county";
import { meridianRecordUrl,type MeridianCase } from "@/lib/sources/meridian";
import type { MunicipalCase } from "@/lib/sources/municipal";
import { isPrivateDocument } from "@/lib/case-details";
import { discoverNampaDocuments } from "./discover";
import { allowedSource,sourceRequest } from "./source-access";
import { walkLibrary } from "./libraries";
import { documentId } from "./ingest";
import { emptyEvidenceState,publicFields,type SourceDocument,type IngestionRun,type DocumentKind,type PageText } from "./types";
import type { EvidenceStore } from "./store";
export function areaDocumentKind(area:AreaDefinition,title:string):DocumentKind{
 return area.timeline?.documentRules.find(r=>new RegExp(r.pattern,"i").test(title))?.kind??(/packet/i.test(title)?"staff-report":/agenda/i.test(title)?"agenda":"other");
}
export function prioritizeCases(cases:Hearing[],timezone:string,now=new Date()){
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:timezone}).format(now);
 const next=(h:Hearing)=>h.meetings.filter(m=>m.date>=today&&!m.continuedNote).map(m=>m.date).sort()[0]??"9999";
 const recent=(h:Hearing)=>h.meetings.map(m=>m.date).sort().at(-1)??h.appId.match(/20\d{2}/)?.[0]??"";
 return [...cases].sort((a,b)=>next(a).localeCompare(next(b))||recent(b).localeCompare(recent(a))||a.appId.localeCompare(b.appId));
}
export function recordDocuments(area:AreaDefinition,h:Hearing):SourceDocument[]{
 const docs:SourceDocument[]=[];const areaId=area.id;
 const add=(url:string|undefined,title:string,kind=areaDocumentKind(area,title))=>{if(url&&allowedSource(url,areaId)&&!isPrivateDocument(title)&&(kind!=="other"||/\.pdf(?:[?#]|$)|DownloadDocument/i.test(url+" "+title)))docs.push({areaId,url,title,kind,caseIds:[h.appId]});};
 let recordUrl=h.externalUrl,appliedDate:string|undefined,reviewDate:string|undefined;
 if(area.timeline?.adapter==="county"){
  const county=(h as CountyCase).county;appliedDate=county?.appliedDate;
  for(const event of county?.events??[])for(const doc of event.documents)add(doc.url,doc.label+" — "+doc.filename);
  recordUrl=county?.events.at(-1)?.sourceUrl??h.externalUrl;
 }else if(area.timeline?.adapter==="meridian"){
  const m=(h as MeridianCase).meridian;recordUrl=meridianRecordUrl(h)||m?.notices.at(-1)?.filesUrl||h.externalUrl;
  reviewDate=/accepted|review/i.test(m?.workflowStatus??"")?m?.workflowDate:undefined;
 }else for(const doc of (h as MunicipalCase).municipal?.documents??[])add(doc.url,doc.label+" — "+doc.filename);
 if(recordUrl&&allowedSource(recordUrl,areaId)){
  const fields:NonNullable<SourceDocument["fields"]>=h.appStatus?[{key:"caseStatus",value:h.appStatus,quote:"Status: "+h.appStatus,page:null}]:[];
  if(appliedDate)fields.push({key:"appliedDate",value:appliedDate,quote:"Applied: "+appliedDate,page:null});
  if(reviewDate)fields.push({key:"reviewDate",value:reviewDate,quote:"Review: "+reviewDate,page:null});
  docs.push({areaId,url:recordUrl,title:h.appId+" official case record",caseIds:[h.appId],kind:"case-record",content:JSON.stringify(h),fields});
 }
 for(const m of h.meetings){
  if(!m.continuedNote&&allowedSource(m.sourceUrl,areaId)){
   const key=m.body===area.bodies.decision.id?"councilHearingDate":m.body===area.bodies.planning.id?"pzHearingDate":undefined;
   docs.push({areaId,url:m.sourceUrl.split("#")[0]+"#hearing-"+h.appId+"-"+m.date,title:h.appId+" hearing — "+m.date,caseIds:[h.appId],kind:"agenda",content:JSON.stringify(m),meeting:{body:m.body,date:m.date,isHearing:true},fields:key?[{key,value:m.date,quote:m.bodyLabel+" — "+m.date,page:null}]:[]});
  }
  add(m.minutesUrl,m.bodyLabel+" minutes — "+m.date,"minutes");add(m.packetUrl,m.bodyLabel+" meeting packet — "+m.date,"staff-report");
  for(const report of m.staffReports??[])add(report.url,report.label,"staff-report");
  if(m.agendaUrl&&/\.pdf(?:[?#]|$)|DownloadDocument|Archive\/ViewFile/i.test(m.agendaUrl))add(m.agendaUrl,m.bodyLabel+" agenda — "+m.date,"agenda");
 }
 return docs;
}
export async function discoverCaseDocuments(options:{caseIds?:string[];budgetMs?:number;store?:EvidenceStore;deadline?:number;run?:IngestionRun;feeds?:Record<string,HearingFeed>}={}){
 const deadline=options.deadline??Date.now()+(options.budgetMs??100000),state=options.store?await options.store.read():emptyEvidenceState();
 const areaCases=new Map<string,Set<string>>();
 const warnings:string[]=[],documents:SourceDocument[]=[],caseIds:string[]=[],extractedPages=new Map<string,PageText[]>();
 const areas=Object.values(AREAS).filter(a=>a.status==="live"&&a.timeline);
 const configured=process.env.TIMELINE_CASE_IDS??"*";
 const selected=options.caseIds??(configured==="*"?undefined:configured.split(",").map(s=>s.trim().toUpperCase()));
 const feeds=await Promise.all(areas.map(async area=>{
  try{
   const feed=options.feeds?.[area.id]??await getLocality(area.id)?.getHearings?.();
   return {area,feed};
  }catch{warnings.push(area.id+": case feed unavailable; cached documents retained");return {area,feed:undefined};}
 }));
 const libraryJobs:{area:AreaDefinition;h:Hearing;url:string}[]=[];
 for(const {area,feed} of feeds){
  const all=[...(feed?.active??[]),...(feed?.upcomingOnly??[]),...(feed?.completed??[])];
  const unresolved=new Set(Object.values(state.documents).filter(d=>(d.areaId??"nampa")===area.id&&!d.caseIds.every(id=>publicFields(state,[id],area.id).some(f=>f.key==="councilDecision"&&f.status==="approved"&&["approved","denied","withdrawn"].includes(f.value)))).flatMap(d=>d.caseIds));
  const eligible=prioritizeCases([...new Map(all.filter(h=>selected?selected.includes(h.appId):!h.decisionRecorded||unresolved.has(h.appId)||h.meetings.some(m=>m.date>=new Date().toISOString().slice(0,10))).map(h=>[h.appId,h])).values()],area.timezone);
  const ids=[...new Set([...eligible.map(h=>h.appId),...unresolved].filter(id=>!selected||selected.includes(id)))];caseIds.push(...ids);areaCases.set(area.id,new Set(ids));
  if(options.run)(options.run.areas??={})[area.id]={cases:ids.length,visited:0,documents:0,extracted:0};
  if(area.timeline?.adapter==="energov-primegov"){
   if(Date.now()<deadline){const found=await discoverNampaDocuments({store:options.store,feed,caseIds:ids,deadline:Math.min(deadline,Date.now()+20000)});documents.push(...found.documents.map(d=>({...d,areaId:area.id})));warnings.push(...found.warnings);for(const [k,v]of found.extractedPages)extractedPages.set(k,v);if(options.run)options.run.areas![area.id].visited=new Set(found.documents.flatMap(d=>d.caseIds)).size;}
   continue;
  }
  for(const h of eligible){documents.push(...recordDocuments(area,h));if(options.run)options.run.areas![area.id].visited++;
   const roots=[...h.meetings.flatMap(m=>[m.agendaUrl,m.minutesUrl]).filter((url):url is string=>Boolean(url&&!/\.pdf(?:[?#]|$)|\/d\/f\?|DownloadFile|DownloadDocument|Archive\/ViewFile/i.test(url))),h.externalUrl,...(area.id==="meridian"?(h as MeridianCase).meridian?.notices.map(n=>n.filesUrl)??[]:(h as MunicipalCase).municipal?.documents.map(d=>d.url)??[])];
   for(const root of new Set(roots))if(root&&allowedSource(root,area.id)&&/Browse\.aspx|sharepoint\.com|AgendaViewer|MinutesViewer|AgendaOnline|meetings\.municode\.com/i.test(root))libraryJobs.push({area,h,url:root});
  }
 }
 // Resume known sources even if this run's case-record discovery stopped early.
 for(const d of Object.values(state.documents))if(d.caseIds.some(id=>areaCases.get(d.areaId??"nampa")?.has(id))&&AREAS[d.areaId??"nampa"]?.status==="live")documents.push({areaId:d.areaId,url:d.url,title:d.title,kind:d.kind,caseIds:d.caseIds,content:d.content,fields:d.fields,meeting:d.meeting});
 // Probe public portals once per run so blocked hosts are reported even when using cached notices.
 await Promise.all(areas.filter(a=>a.id==="meridian"&&Date.now()<deadline-13000).map(async a=>{if(a.sources.hearingsSchedule)try{await (await sourceRequest(a.sources.hearingsSchedule,a.id)).body?.cancel();}catch{warnings.push(a.id+": hearing notice host unavailable; using cached meeting associations");}}));
 if(options.store){
  // Rotate library work across areas/cases; completed and blocked roots cannot starve the backlog.
  const offset=Number(state.cursors?.libraries??0)%Math.max(1,libraryJobs.length);const jobs=[...libraryJobs.slice(offset),...libraryJobs.slice(0,offset)];let visited=0;
  for(const job of jobs){if(Date.now()>=deadline-14000)break;visited++;
   try{for(const file of await walkLibrary(job.area.id,job.h.appId,job.url,options.store,Math.min(deadline,Date.now()+14000))){const kind=areaDocumentKind(job.area,file.title);if(kind!=="other"&&!isPrivateDocument(file.title))documents.push({areaId:job.area.id,caseIds:[job.h.appId],kind,...file});}}
   catch(error){warnings.push(job.area.id+" library "+job.h.appId+": "+(error instanceof Error?error.message:"Unavailable"));}
  }
  await options.store.mutate(s=>{(s.cursors??={}).libraries=String((offset+visited)%Math.max(1,libraryJobs.length));});
 }
 const merged=new Map<string,SourceDocument>();
 for(const d of documents){const id=documentId(d),old=merged.get(id);merged.set(id,old?{...old,caseIds:[...new Set([...old.caseIds,...d.caseIds])]}:d);}
 const result=[...merged.values()];
 if(options.store)await options.store.mutate(s=>{for(const d of result){const id=documentId(d);if(!s.documents[id])s.documents[id]={...d,id,hash:"",pages:[],checkedAt:new Date().toISOString(),state:"processing",failCount:0};}});for(const area of areas)if(options.run)options.run.areas![area.id].documents=result.filter(d=>(d.areaId??"nampa")===area.id).length;
 // New evidence first; round-robin jurisdictions to avoid one large area's packet backlog monopolizing runs.
 const pending=result.filter(d=>{const old=state.documents[documentId(d)];return !old||old.state!=="complete";}),complete=result.filter(d=>!pending.includes(d));
 const interleave=(docs:SourceDocument[])=>{const groups=areas.map(a=>docs.filter(d=>(d.areaId??"nampa")===a.id).sort((a,b)=>({"pz-decision":0,"council-decision":0,findings:0,"staff-report":1,minutes:2,"case-record":3,agenda:4,other:5}[a.kind])-({"pz-decision":0,"council-decision":0,findings:0,"staff-report":1,minutes:2,"case-record":3,agenda:4,other:5}[b.kind])));const out:SourceDocument[]=[];while(groups.some(g=>g.length))for(const g of groups){const d=g.shift();if(d)out.push(d);}return out;};
 return {documents:[...interleave(pending),...interleave(complete)],warnings,caseIds:[...new Set(caseIds)],extractedPages};
}
