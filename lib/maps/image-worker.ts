import {claimDocumentWork} from "@/lib/timeline/document-work-lease";
import {privacyOverrides} from "@/lib/residential-privacy-store";
import {residentialCase} from "@/lib/residential-privacy";
import sharp from "sharp";
import {createHash} from "node:crypto";
import {JURISDICTIONS} from "./jurisdictions";
import {mapImageCases,readMapSnapshot,markCaseVisualScan} from "./store";
import {imageReviews,displayedImageReviews,saveImageReview,publishCaseImage} from "./image-review-store";
import {enqueueImages,claimImageJob,saveImageJob} from "./image-job-store";
import {saveVisualAsset} from "./visual-store";
import {visualPreview} from "./preview-crop";
import {scanDocumentVisuals,visualPriority,type ScanResult} from "./image-scan";
import {approvedImageCheck,IMAGE_CHECK_VERSION,imageCaption} from "./image-policy";
import {fallbackCaseImage} from "./fallback-image";
import {sourceImageDate} from "./visuals";
import {downloadDocument,digest} from "@/lib/timeline/ingest";
import {isBlockedSource} from "@/lib/timeline/source-access";
import type {Hearing} from "@/lib/localities/types";
import type {MapVisual} from "./types";
export async function seedImageQueue(){let total=0;for(const a of Object.values(JURISDICTIONS).filter(a=>a.area?.status==="live")){const cases=await mapImageCases(a.id);await enqueueImages(cases.map(c=>({areaId:a.id,caseId:c.id})));total+=cases.length;}return total;}
export async function imageCoverage(){
 const overrides=await privacyOverrides();
 const rows=await imageReviews(),active=displayedImageReviews(rows),result=[];
 for(const area of Object.values(JURISDICTIONS).filter(a=>a.area?.status==="live")){
 const cases=await mapImageCases(area.id);let plans=0,aerial=0,fallback=0;
 for(const c of cases){const v=residentialCase(area.id,c.id,{},overrides)?undefined:active.find(r=>r.areaId===area.id&&r.caseIds.includes(c.id))?.visual;if(v?.approval?.generated)fallback++;else if(v?.approval?.type==="vicinity/aerial exhibit")aerial++;else if(v)plans++;}
 result.push({area:area.id,cases:cases.length,geometry:cases.filter(c=>c.hasGeometry&&!c.citywide).length,plans,aerial,real:plans+aerial,fallback,empty:cases.length-plans-aerial-fallback});
 }return result;
}
async function processImageJob(options:{budgetMs?:number;target?:{areaId:string;caseId:string};fallbackOnly?:boolean}={}){
 const started=Date.now(),deadline=started+(options.budgetMs??250000);const job=await claimImageJob(options.target,options.fallbackOnly);if(!job)return {status:"idle",checked:0};
 const config=JURISDICTIONS[job.areaId],resuming=job.status==="deferred"||job.status==="blocked";job.attempts++;job.errors=[];job.checked=0;
 const checkpoint=()=>saveImageJob(job);let accepted=0,blocked=false,fallbackFailed=false;
 try{
  const snapshot=await readMapSnapshot(job.areaId,{caseIds:[job.caseId],includeFlum:false}),item=snapshot?.cases[0];if(!config||!item)throw new Error("Case map metadata unavailable");
  const prior=displayedImageReviews(await imageReviews(job.areaId,[job.caseId]));
  // A fallback is safe to publish immediately, while official-source discovery continues.
  if(!prior.length&&item.geometry)try{await fallbackCaseImage(job.areaId,item);}catch(e){fallbackFailed=true;job.errors.push("Fallback: "+(e instanceof Error?e.message:"unavailable"));}
  if(options.fallbackOnly){job.fallbackReady=!fallbackFailed;job.fallbackRetryAt=fallbackFailed?new Date(Date.now()+86400000).toISOString():undefined;return {status:"fallback pass",area:job.areaId,caseId:job.caseId,checked:0,hasGeometry:Boolean(item.geometry),errors:job.errors};}
  const feed=await config.loadCases?.().catch(()=>undefined);
  const hearing=[...(feed?.active??[]),...(feed?.completed??[]),...(feed?.upcomingOnly??[])].find(h=>h.appId===job.caseId)??({appId:item.id,appType:item.type,appTypeLabel:item.typeLabel,appStatus:"",appPhase:"Review",appPhaseRaw:"Review",appScope:item.summary,meetings:[],energovPlanId:null,externalUrl:null,appAcres:null} as Hearing);
  const discoveryDeadline=Math.min(deadline-60000,Date.now()+70000);
  if(config.loadCaseDocuments&&Date.now()<discoveryDeadline){const found=await config.loadCaseDocuments(job.caseId,{hearing,feed,job,deadline:discoveryDeadline,checkpoint});job.documents=found.documents;job.discoveryComplete=found.complete;await checkpoint();}
  job.documents.sort((a,b)=>visualPriority(a.title)-visualPriority(b.title)||(b.date??sourceImageDate(b.title)??"").localeCompare(a.date??sourceImageDate(a.title)??""));
  for(const doc of job.documents){if(Date.now()>deadline-15000)break;const key=digest(doc.url);if(resuming&&job.scans[key]?.complete&&job.scans[key]?.version==="graphics-area-v3")continue;if(Date.parse(job.scans[key]?.retryAt??"")>Date.now())continue;try{
   const bytes=doc.attachmentId&&config.recordClient?.downloadPublicAttachment?await config.recordClient.downloadPublicAttachment(doc.attachmentId,{timeoutMs:Math.min(90000,Math.max(1000,deadline-Date.now()-15000))}):await downloadDocument(doc.url,job.areaId,{maxBytes:128000000,timeoutMs:Math.min(90000,Math.max(1000,deadline-Date.now()-15000))});job.checked++;
   const documentDeadline=Math.min(deadline-1500,Date.now()+85000);
   const candidate=async(result:ScanResult)=>{const id=createHash("sha256").update(IMAGE_CHECK_VERSION+job.areaId+doc.url+result.approval.pageHash+String(result.page??0)).digest("hex"),src="/api/maps/"+job.areaId+"/visual/"+id;
    const allowed=approvedImageCheck(result.approval);await saveVisualAsset(job.areaId,id,{image:(allowed?result.image:await sharp(result.image).resize({width:480,height:640,fit:"inside",withoutEnlargement:true}).webp({quality:60}).toBuffer()).toString("base64"),page:result.page,approval:result.approval,...(allowed?{preview:await visualPreview(result.image,result.approval.pageHash)}:{})});
    const visual:MapVisual={src,fullSizeUrl:src,sourceUrl:doc.url+(result.page&&!doc.url.includes("#/plan/")?"#page="+result.page:""),documentTitle:doc.title,label:imageCaption(result.approval),alt:imageCaption(result.approval),kind:result.approval.type==="vicinity/aerial exhibit"?"context":"proposal",approval:result.approval};
    const reviewId=createHash("sha256").update(job.areaId+[job.caseId].join(",")+src).digest("hex");await saveImageReview({id:reviewId,areaId:job.areaId,caseIds:[job.caseId],title:doc.title,sourceUrl:visual.sourceUrl,originalSrc:src,visual,documentDate:doc.date??sourceImageDate(doc.title),outcome:allowed?"accepted":"rejected",reason:allowed?"Full page passed privacy and type checks":result.approval.type,checkedAt:new Date().toISOString()});if(allowed){accepted++;await publishCaseImage(job.areaId,[job.caseId],visual);}
   };
   await scanDocumentVisuals(bytes,doc.title,{deadline:documentDeadline,sourceDate:sourceImageDate(doc.title),caseId:job.caseId,packetCaseIds:[...(feed?.active??[]),...(feed?.completed??[]),...(feed?.upcomingOnly??[])].map(h=>h.appId),packet:doc.packet,progress:job.scans[key],checkpoint:async scan=>{job.scans[key]=scan;await checkpoint();},candidate});
  }catch(e){blocked ||= isBlockedSource(e);job.errors.push(new URL(doc.url).hostname+": "+(e instanceof Error?e.message:"unavailable"));job.failedAt=new Date().toISOString();await checkpoint();}}
  const complete=job.discoveryComplete===true&&job.documents.every(d=>job.scans[digest(d.url)]?.complete);
  if(complete){job.status="complete";job.finishedAt=new Date().toISOString();job.dueAt=new Date(Date.now()+7*86400000).toISOString();await markCaseVisualScan(job.areaId,job.caseId,job.finishedAt);}
  else{job.status=blocked?"blocked":"deferred";job.failedAt=new Date().toISOString();job.dueAt=new Date(Date.now()+(job.errors.length||Object.values(job.scans).some(s=>Date.parse(s.retryAt??"")>Date.now())?86400000:300000)).toISOString();}
  return {status:job.status,area:job.areaId,caseId:job.caseId,checked:job.checked,accepted,documents:job.documents.length,errors:job.errors,elapsedMs:Date.now()-started};
 }catch(e){job.status="deferred";job.failedAt=new Date().toISOString();job.dueAt=new Date(Date.now()+86400000).toISOString();job.errors.push(e instanceof Error?e.message:"Image scan unavailable");return {status:job.status,area:job.areaId,caseId:job.caseId,checked:job.checked,errors:job.errors};}
 finally{job.errors=job.errors.slice(-25);await saveImageJob(job,true);console.info("[images:case]",JSON.stringify({area:job.areaId,caseId:job.caseId,status:job.status,checked:job.checked,attempts:job.attempts,elapsedMs:Date.now()-started}));}
}

export async function processImageQueue(options:Parameters<typeof processImageJob>[0]={}){
 const release=await claimDocumentWork();if(!release)return {status:"busy",checked:0,reason:"Another document worker is running"};
 try{return await processImageJob(options);}finally{await release();}
}
