import { projects } from "@/lib/projects";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { JURISDICTIONS } from "./jurisdictions";
import { readMapSnapshot } from "./store";
import { documentPreview } from "./visuals";
import { downloadDocument } from "@/lib/timeline/ingest";
import { imageReviews, saveImageReview, type ImageReview } from "./image-review-store";
import type { MapVisual } from "./types";
import { forbiddenImageDocument, allowedImageTitle } from "./image-policy";
export async function auditDisplayedImages(options:{areaId?:string;limit?:number;deadline?:number}={}) {
 const reviews=await imageReviews(),existing=new Map(reviews.map(r=>[r.id,r])),inventory:ImageReview[]=[];
 for(const config of Object.values(JURISDICTIONS).filter(c=>!options.areaId||c.id===options.areaId)){
  const snapshot=await readMapSnapshot(config.id,{includeFlum:false});
  const candidates=new Map<string,{visual:MapVisual;caseIds:string[]}>();
  for(const c of snapshot?.cases??[]){const v=config.caseVisuals?.[c.id]??c.visual;if(v){const prior=candidates.get(v.src);candidates.set(v.src,{visual:v,caseIds:[...new Set([...(prior?.caseIds??[]),c.id])]});}}
  for(const project of projects.filter(p=>(p.areaId??"nampa")===config.id))if(project.image&&!candidates.has(project.image))candidates.set(project.image,{caseIds:project.caseIds,visual:{src:project.image,fullSizeUrl:project.image,sourceUrl:project.image,label:"Earlier aerial · March neighborhood notice",alt:"Earlier aerial",kind:"context"}});
  for(const [caseId,v]of Object.entries(config.caseVisuals??{})){const prior=candidates.get(v.src);candidates.set(v.src,{visual:v,caseIds:[...new Set([...(prior?.caseIds??[]),caseId])]});}
  for(const {visual:v,caseIds}of candidates.values()){
   const id=createHash("sha256").update(config.id+v.src).digest("hex");
   const prior=existing.get(id);
   if(prior){inventory.push(prior);continue;}
   const entry:ImageReview={id,areaId:config.id,caseIds,title:v.documentTitle??v.label,sourceUrl:v.sourceUrl,originalSrc:v.src,outcome:"withdrawn",checkedAt:new Date().toISOString()};
   await saveImageReview(entry);inventory.push(entry);
  }
 }
 let processed=0;
 for(const entry of inventory.filter(r=>r.outcome==="withdrawn")){
  if(processed>=(options.limit??2)||Date.now()>(options.deadline??Date.now()+100000)-47000)break;
  processed++;
  const config=JURISDICTIONS[entry.areaId];
  const original=Object.values(config.caseVisuals??{}).find(v=>v.src===entry.originalSrc);
  const title=entry.title;
  if(forbiddenImageDocument.test(title)||(!allowedImageTitle(title)&&!/staff[\s_-]*report/i.test(title))){entry.outcome="rejected";entry.reason="Document title/type is outside the visual allowlist";await saveImageReview(entry);continue;}
  try{
   let bytes:Uint8Array;
   if(original?.src.startsWith("/")&&!original.src.startsWith("/api/")){
    const relative=(original.fullSizeUrl??original.src).replace(/^\/us\/id\/([^/]+)\//,"/$1/");
    const root=path.resolve(process.cwd(),"public"),file=path.resolve(root,"."+relative);
    if(!file.startsWith(root+path.sep))throw new Error("Invalid public asset path");bytes=await readFile(file);
   }else{
    if(entry.sourceUrl.includes("#/plan/")){entry.outcome="blocked";entry.reason="Original city record is not a downloadable plan; legacy crop was withdrawn";await saveImageReview(entry);continue;}
    bytes=await downloadDocument(entry.sourceUrl.split("#")[0],entry.areaId);
   }
   const visual=await documentPreview(entry.areaId,bytes,title,entry.sourceUrl.split("#")[0],options.deadline);
   entry.checkedAt=new Date().toISOString();entry.outcome=visual?"accepted":"rejected";
   entry.reason=visual?"Full source page passed the allowlist and privacy classifier":"No source page passed the title, page type and privacy checks";entry.visual=visual;
   await saveImageReview(entry);
  }catch{entry.outcome="blocked";entry.reason="Source unavailable; image stays withdrawn";await saveImageReview(entry);}
 }
 const current=await imageReviews();
 const areas=Object.values(JURISDICTIONS).map(a=>{const rows=current.filter(r=>r.areaId===a.id);return {area:a.id,total:rows.length,kept:rows.filter(r=>r.outcome==="accepted"&&!r.hidden).length,removed:rows.filter(r=>r.outcome!=="accepted"||r.hidden).length,deferred:rows.filter(r=>r.outcome==="withdrawn").length};});
 return {processed,areas,remaining:current.filter(r=>r.outcome==="withdrawn").length};
}
