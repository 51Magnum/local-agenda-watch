import {createHash,randomUUID} from "node:crypto";
import {jurisdiction} from "./registry";
import {sourceHttp} from "./collect";
import {SourceFailure} from "./http";
import {arcgisAdapter,applicationAdapter} from "./adapters/arcgis";
import {agendaAdapter} from "./adapters";
import {allowedAttachment} from "./adapters/common";
import {readStaging,saveStaging,readQa,saveQa,snapshotHash,type QaReport} from "./store";
import {computeDeadlines} from "./participation";
import {withJurisdictionAi,jurisdictionSpend} from "./ai-budget";
import {ingestDocuments} from "../timeline/ingest";
import {extractNativePdfChunk} from "../timeline/extract";
import {getEvidenceStore} from "../timeline/store";
import type {PageText,SourceDocument} from "../timeline/types";
import {documentPreview} from "../maps/visuals";
export async function validateEndpoints(areaId:string){
 const d=jurisdiction(areaId);if(!d)throw Error("Unknown jurisdiction");const http=sourceHttp(areaId),gis=arcgisAdapter(http),now=new Date(),range={start:now.toISOString().slice(0,10),end:new Date(now.getTime()+45*86400000).toISOString().slice(0,10)};
 for(const url of [...new Set([d.boundary.url,...Object.values(d.gis)])]){try{await gis.metadata(url!);}catch{}}
 try{await gis.query(d.boundary.url,d.boundary.where);}catch{}
 await applicationAdapter(d,http).healthcheck();
 for(const source of d.agenda){const adapter=agendaAdapter(d,source,http);try{const meetings=await adapter.listMeetings(range);if(http.checks.at(-1))http.checks.at(-1)!.records=meetings.length;if(meetings.length){const m=await adapter.getMeeting(meetings[0].id);const a=[...m.items.flatMap(i=>i.attachments),...m.attachments].find(a=>allowedAttachment(a,d));if(a)await http.request(a.url,{method:"HEAD"},d.documents.maxBytes);}}catch(e){if(!(e instanceof SourceFailure))http.checks.push({url:String(source.params.baseUrl),state:"unavailable",reason:e instanceof Error?e.message:String(e),latencyMs:0,checkedAt:new Date().toISOString()});}}
 if(d.participation.testimonySignupUrl)try{await http.text(d.participation.testimonySignupUrl,{},4000000);}catch{}
 const snapshot=await readStaging(areaId);if(snapshot){snapshot.health.push(...http.checks);await saveStaging(snapshot);}
 return{areaId,checkedAt:new Date().toISOString(),health:http.checks,passed:http.checks.length>0&&http.checks.every(h=>h.state==="ok"||h.state==="skipped")};
}
export async function sampleAi(areaId:string,options:{n?:number;maxUsd?:number;budgetMs?:number}={}){
 const d=jurisdiction(areaId),snapshot=await readStaging(areaId);if(!d||!snapshot)throw Error("Run backfill --write before sample-ai");
 const n=options.n??5,maxUsd=options.maxUsd??1;if(!Number.isInteger(n)||n<1||n>5||!Number.isFinite(maxUsd)||maxUsd<=0||maxUsd>1)throw Error("AI sample accepts 1–5 documents and a hard cap of at most $1");
 if(!process.env.OPENAI_API_KEY||!process.env.DATABASE_URL)return{areaId,status:"deferred",reason:"AI samples require configured durable budget storage and server-side OpenAI credentials",sampled:0,spentUsd:0};
 const id=randomUUID(),http=sourceHttp(areaId),store=getEvidenceStore(),deadline=Date.now()+(options.budgetMs??220000),seen=new Set(snapshot.aiSamples?.map(s=>s.hash)),samples=snapshot.aiSamples??[];let attempted=0;
 const candidates=snapshot.meetings.flatMap(m=>m.items.flatMap(i=>i.attachments.filter(a=>a.kind==="staff_report"&&allowedAttachment(a,d)).map(a=>({meeting:m,item:i,attachment:a}))));
 for(const candidate of candidates){if(samples.length>=n||attempted>=n||Date.now()>deadline-50000)break;const {meeting,item,attachment}=candidate,caseId=item.caseNumbers[0];if(!caseId)continue;
  try{const response=await http.request(attachment.url,{},d.documents.maxBytes),bytes=response.bytes,hash=createHash("sha256").update(bytes).digest("hex");if(seen.has(hash))continue;seen.add(hash);attempted++;
   const chunk=await extractNativePdfChunk(bytes.slice(),{deadline:Math.min(deadline-40000,Date.now()+35000)});const pages:PageText[]=[];let chars=0;for(const p of chunk.pages){if(pages.length>=d.documents.maxPages||chars+p.text.length>20000)break;pages.push(p);chars+=p.text.length;}
   if(!pages.some(p=>p.text.trim().length>30)){snapshot.skipped.push({url:attachment.url,reason:"AI sample deferred: native text unavailable; bounded OCR is required"});continue;}
   const doc:SourceDocument={areaId,url:attachment.url,title:attachment.title,caseIds:[caseId],kind:"staff-report",meeting:{body:d.hearingBodies.find(b=>b.key===meeting.body)?.name??meeting.body,date:meeting.date,isHearing:true}};
   const run=await withJurisdictionAi({areaId,mode:"backfill",sample:{id,maxUsd},documentHash:hash},()=>ingestDocuments(store,[doc],{download:async()=>bytes,text:async()=>pages,ocr:async()=>{throw Error("AI work deferred: sample uses bounded native pages only");},budgetMs:Math.min(90000,deadline-Date.now())}));
   const state=store.readCase?await store.readCase(areaId,[caseId]):await store.read();const fields=Object.values(state.fields).filter(f=>f.areaId===areaId&&f.caseId===caseId&&f.documentHash===hash).map(f=>({key:f.key,value:f.value,page:f.page,sourceUrl:f.sourceUrl,status:f.status}));
   if(fields.length)samples.push({caseId,hash,sourceUrl:attachment.url,pageCount:pages.length,fields,costUsd:run.costUsd??0,tokens:run.usage?.reduce((n,u)=>n+u.totalTokens,0)??0});
   if(Date.now()<deadline-25000){try{const visual=await withJurisdictionAi({areaId,mode:"backfill",sample:{id,maxUsd},documentHash:hash},()=>documentPreview(areaId,bytes,attachment.title,attachment.url,Math.min(deadline-5000,Date.now()+20000)));if(visual)(snapshot.visuals??={})[caseId]={...visual,label:"Image from "+attachment.title+" · "+visual.label,note:visual.kind==="context"?"Location/context image, not the proposed design.":undefined};}catch(e){snapshot.skipped.push({url:attachment.url,reason:"Image review deferred: "+String(e)});}}
   if(pages.length<chunk.totalPages)snapshot.skipped.push({url:attachment.url,reason:"Bounded AI sample inspected "+pages.length+" of "+chunk.totalPages+" pages; remaining appendices are deferred, not declared empty"});
   for(const error of run.errors)snapshot.skipped.push({url:attachment.url,reason:error});
  }catch(e){snapshot.skipped.push({url:attachment.url,reason:e instanceof Error?e.message:String(e)});if(/dollar cap|AI work deferred/.test(String(e)))break;}
 }
 snapshot.aiSamples=samples;snapshot.health.push(...http.checks);await saveStaging(snapshot);const spend=await jurisdictionSpend(areaId);return{areaId,sampleId:id,sampled:samples.length,attempted,spend};
}
export async function qaReport(areaId:string){
 const d=jurisdiction(areaId),snapshot=await readStaging(areaId);if(!d||!snapshot)throw Error("Run backfill --write first");
 const aliases=new Set(snapshot.applications.flatMap(a=>[a.recordId,...a.relatedCaseNumbers])),items=snapshot.meetings.flatMap(m=>m.items).filter(i=>i.caseNumbers.length),matched=items.filter(i=>i.caseNumbers.some(id=>aliases.has(id))),located=snapshot.applications.filter(a=>a.geometry),unknownLocation=snapshot.applications.filter(a=>!a.geometry&&!a.address&&!a.parcel.length);
 const checks=[{name:"hard-fact sources",passed:snapshot.health.some(h=>h.state==="ok"),detail:"Actual endpoint checks recorded; failures retained."},{name:"collection complete",passed:snapshot.complete,detail:snapshot.complete?"Bounded collection completed":"Some collection work is deferred or unavailable"},{name:"boundary",passed:!!snapshot.boundary&&(!d.clipRule||!!snapshot.coverageBoundary),detail:d.clipRule?"County coverage must exclude all incorporated cities":"Official city boundary"},{name:"case matching",passed:items.length>0&&matched.length/items.length>=.8,detail:matched.length+" of "+items.length+" hearing items match the application inventory"},{name:"AI sample",passed:(snapshot.aiSamples??[]).filter(s=>Array.isArray(s.fields)&&s.fields.length>0).length>=1,detail:"At least one source-backed AI sample is required; sensitive fields stay under review"},{name:"runtime download check",passed:!!snapshot.runtime?.gitCommit&&snapshot.runtime.checks.length>0&&snapshot.runtime.checks.every(h=>h.state==="ok"),detail:"A Git-sourced Vercel-runtime document check is required separately"}];
 const upcoming=[...snapshot.meetings.map(m=>({date:m.date,body:m.body,meetingUrl:m.meetingPageUrl,tentative:false})),...(snapshot.calendarHints??[]).filter(m=>!m.backup).map(m=>({date:m.date,body:m.body,meetingUrl:m.sourceUrl,tentative:true}))];
 const next=upcoming.filter(m=>m.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,2).map(m=>({...m,deadlines:computeDeadlines(d,m.date,m.body)}));
 const budgetSpend=process.env.DATABASE_URL?await jurisdictionSpend(areaId):[];
 const spent=budgetSpend.filter(b=>b.bucket.startsWith("sample:")).reduce((n,b)=>n+b.spent,0);
 const report:QaReport={id:createHash("sha256").update(snapshotHash(snapshot)+JSON.stringify(checks)).digest("hex"),areaId,createdAt:new Date().toISOString(),passed:checks.every(c=>c.passed),snapshotHash:snapshotHash(snapshot),checks,data:{health:snapshot.health,runtime:snapshot.runtime,meetings:snapshot.meetings.length,items:items.length,applications:snapshot.applications.length,caseMatchRate:items.length?matched.length/items.length:0,geometryMatchRate:snapshot.applications.length?located.length/snapshot.applications.length:0,itemsWithNoLocation:unknownLocation.length,skipped:snapshot.skipped,aiSamples:snapshot.aiSamples??[],tokens:snapshot.aiSamples?.reduce((n,s)=>n+s.tokens,0)??0,spentUsd:spent,budgetSpend,extractionOnlySpendUsd:snapshot.aiSamples?.reduce((n,s)=>n+s.costUsd,0)??0,projectedMonthlyUsd:{low:d.type==="county"?0:3,high:d.type==="county"?2:10,basis:"Planning estimate from onboarding brief, not measured spend; validate after one month"},nextHearings:next,mapChecklist:["Official boundary verified","County clipped below city layers","Distinct jurisdiction color","No location invented for unmapped applications","No public map, sitemap, search or email exposure"],notes:d.notes}};
 await saveQa(report);return report;
}
export function reportMarkdown(report:QaReport){return "# "+report.areaId+" onboarding QA\n\nAs of "+report.createdAt+". Status: "+(report.passed?"PASS":"NOT READY FOR PUBLIC LAUNCH")+".\n\n"+report.checks.map(c=>"- "+(c.passed?"[x]":"[ ]")+" "+c.name+": "+c.detail).join("\n")+"\n\n```json\n"+JSON.stringify(report.data,null,2)+"\n```\n";}
export {readQa};
export async function checkRuntimeDocuments(areaId:string){
 if(!process.env.VERCEL_GIT_COMMIT_SHA)throw Error("Runtime check requires a Git-sourced Vercel deployment");
 const snapshot=await readStaging(areaId),d=jurisdiction(areaId);if(!snapshot||!d)throw Error("Backfill first");const http=sourceHttp(areaId);
 const candidates=[...new Map(snapshot.meetings.flatMap(m=>m.items.flatMap(i=>i.attachments)).filter(a=>a.kind==="staff_report"&&allowedAttachment(a,d)).map(a=>[new URL(a.url).hostname,a])).values()];
 for(const a of candidates)try{const r=await http.request(a.url,{},d.documents.maxBytes);if(new TextDecoder().decode(r.bytes.subarray(0,5))!=="%PDF-"){r.health.state="unavailable";r.health.reason="Expected an official PDF; response was another format";}}catch{}
 snapshot.runtime={gitCommit:process.env.VERCEL_GIT_COMMIT_SHA,environment:process.env.VERCEL_ENV??"unknown",checks:http.checks};await saveStaging(snapshot);return snapshot.runtime;
}
