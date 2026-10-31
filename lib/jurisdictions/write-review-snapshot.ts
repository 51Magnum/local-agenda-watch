import {verificationUrl,sourceRecordId} from "./record-links";
import {mkdir,writeFile} from "node:fs/promises";
import {applicationScope,individualApplicant} from "./application-scope";
import {privateProject} from "./preview";
import {stagedFeed,stagedMapSnapshot} from "./resident-records";
import {protectMapCase} from "../residential-privacy";
import {redactSelfCheck,type SelfCheckReport} from "./self-check";
import type {JurisdictionDefinition} from "./types";
import type {StagingSnapshot} from "./store";
import type {ReviewSnapshot} from "./review-snapshot";

const contact=/(?:mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b)/i;
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
/** Drop an entire uncertain field; never rewrite a person's identity into a claim. */
export function scrubReview<T>(value:T,names:string[]=[],dataUrls:string[]=[]):T{
 const identities=names.map(name=>{const all=name.split(/[^\p{L}]+/u).filter(Boolean),main=all.filter(word=>word.length>=2);return main.length>=2?main:main.length?all:[];}).filter(parts=>parts.length>=2);
 const hasPerson=(text:string)=>identities.some(parts=>parts.every(word=>new RegExp("(?:^|[^\\p{L}\\p{N}])"+escape(word)+"(?=$|[^\\p{L}\\p{N}])","iu").test(text)));
 const walk=(item:unknown):unknown=>{
  if(typeof item==="string"){
   let decoded=item;try{decoded=decodeURIComponent(item);}catch{}
   if(contact.test(decoded)||hasPerson(decoded))return undefined;
   if(/^https?:/i.test(item)){try{const u=new URL(item);if(u.protocol!=="https:"||u.username||u.password||/^(?:p?json)$/i.test(u.searchParams.get("f")??"")&&!dataUrls.includes(item))return undefined;}catch{return undefined;}}
   return item;
  }
  if(Array.isArray(item))return item.map(walk).filter(v=>v!==undefined);
  if(item&&typeof item==="object")return Object.fromEntries(Object.entries(item).map(([k,v])=>[k,walk(v)]).filter(([,v])=>v!==undefined));
  return item;
 };return walk(value) as T;
}
export async function writeReviewSnapshot(d:JurisdictionDefinition,snapshot:StagingSnapshot,report:SelfCheckReport){
 if(!snapshot.boundary)throw Error("A verified boundary is required to create a review snapshot");
 const names=snapshot.applications.flatMap(a=>Object.entries(a.sourceFields).filter(([key,value])=>/applicant|owner|contact|planner|staff|assigned/i.test(key)&&individualApplicant(value)).map(([,value])=>String(value)));
 const apps=applicationScope(d,snapshot.applications,snapshot.meetings).map(a=>{const r=report.records.find(r=>r.recordId===a.recordId);return {...a,selfCheckTitle:r?.title,hiddenDocuments:a.hiddenDocuments||r?.checks.some(c=>c.check==="privacy"&&c.status!=="pass")};});
 const input={...snapshot,applications:apps,visuals:undefined,aiSamples:[]},records:ReviewSnapshot["records"]=[];
 const dataUrls=apps.filter(a=>report.records.find(r=>r.recordId===a.recordId)?.checks.find(c=>c.check==="link-resolves-to-case")?.status==="pass").flatMap(a=>verificationUrl(d,sourceRecordId(d,a))??[]);
 const base=`/${d.area.country}/${d.state}/${d.id}`;
 for(const app of apps){
  const result=report.records.find(r=>r.recordId===app.recordId);if(result?.hidden)continue;
  const project=await privateProject(d.id,app.recordId,input,{evidence:false});if(!project)continue;
  project.item.href=base+"/plan/"+encodeURIComponent(app.recordId);project.item.areaId=d.id;project.item.visual=undefined;
  project.relatedCases=project.relatedCases?.map(c=>({...c,href:base+"/plan/"+encodeURIComponent(c.caseId)}));
  if(app.residentialPrivacy){project.item=protectMapCase(d.id,project.item);project.where="Approximate residential area; exact address withheld.";project.documents=[];}
  if(result?.checks.some(c=>c.check==="link-resolves-to-case"&&c.status!=="pass")){
   project.officialRecords=[];project.item.sourceUrl=undefined;project.summarySource=undefined;project.documents=[];project.history=project.history.map(h=>({...h,source:undefined}));
  }
  if(result?.checks.some(c=>c.check==="location-in-boundary"&&c.status!=="pass")){project.item.geometry=null;project.item.centroid=null;project.item.bounds=undefined;project.where="Location not published; verification pending.";}
  const clean=scrubReview(project,names,dataUrls);clean.item.title??="Planning application";clean.item.summary??="Description withheld pending privacy review.";
  if(clean.item.popup){clean.item.popup.projectName??=clean.item.title;clean.item.popup.explanation??=clean.item.summary;}
  clean.history=clean.history.filter(h=>h.label);clean.documents=clean.documents?.filter(doc=>doc.label&&doc.url);clean.officialRecords=clean.officialRecords?.filter(link=>link.url&&link.label);
  records.push({caseId:app.recordId,aliases:app.relatedCaseNumbers,eligible:result?.publish??false,project:clean});
 }
 const feed=scrubReview(stagedFeed(d,input),names);for(const h of feed.active){const r=records.find(r=>r.caseId===h.appId);if(!r)continue;h.displayTitle=r.project.item.title;h.description=r.project.item.summary;h.appScope=r.project.item.summary;h.externalUrl=r.project.officialRecords?.[0]?.url??null;if("record" in h){const record=(h as import("./resident-records").ConfiguredHearing).record;record.documents=r.project.documents?.map(doc=>({label:doc.label,filename:doc.label,url:doc.url,sourceUrl:doc.url}))??[];record.sourceUrl=r.project.officialRecords?.[0]?.url;record.events=record.events.map(e=>({...e,documents:record.documents??[],sourceUrl:r.project.history.find(h=>h.source)?.source??""}));}}
 feed.agendaMeetings=feed.agendaMeetings?.map(m=>({...m,items:m.items.map(i=>({...i,title:records.filter(r=>[r.caseId,...r.aliases].some(id=>i.caseIds.includes(id))).map(r=>r.project.item.title).join(" / "),staffReports:[]}))}));
 const map=stagedMapSnapshot(d,input);map.cases=records.map(r=>({...r.project.item,id:r.caseId,areaId:d.id}));
 const area={...d.area,id:d.id,slug:d.id,name:d.name,type:d.type,state:d.state,status:"live" as const,timezone:d.timezone,color:d.color,boundary:snapshot.boundary,coverageBoundary:snapshot.coverageBoundary};
 delete area.timeline;delete area.residentAccess;
 const safeReport=scrubReview(redactSelfCheck(report),names);for(const r of safeReport.records)for(const c of r.checks)c.sourceUrl??="";for(const q of safeReport.queue)q.check.sourceUrl??="";
 const artifact:ReviewSnapshot={version:1,status:"review",areaId:d.id,collectedAt:snapshot.checkedAt,sourceSnapshotHash:report.snapshotHash,area:scrubReview(area),selfCheck:safeReport,records,feed,map};
 const serialized=JSON.stringify(artifact,null,2)+"\n";if(contact.test(serialized))throw Error("Review snapshot contains contact information");
 await mkdir("data/review",{recursive:true});await writeFile(`data/review/${d.id}.json`,serialized);return artifact;
}
