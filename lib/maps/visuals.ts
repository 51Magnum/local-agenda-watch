import { classifyImagePage } from "./classify-image";
import { allowedImageTitle, forbiddenImageDocument, approvedImageCheck, imageCaption, IMAGE_CHECK_VERSION, type ImageCheck } from "./image-policy";
import { join } from "node:path";
const pdfAssets = join(process.cwd(),"node_modules","pdfjs-dist");
import { createHash } from "node:crypto";
import sharp from "sharp";
import { getDocumentProxy, renderPageAsImage, definePDFJSModule } from "unpdf";
import { isPrivateDocument } from "@/lib/case-details";
import { readVisualAsset, saveVisualAsset } from "./visual-store";
import type { MapVisual, JurisdictionConfig } from "./types";
import type { Hearing } from "@/lib/localities/types";
import { downloadDocument } from "@/lib/timeline/ingest";
let rendererReady: Promise<void> | undefined;
const proposal = /site[\s_-]*plan|concept|prelim(?:inary)?[\s_-]*plat|landscape[\s_-]*plan|elevation|rendering/i;
export function previewCandidate(title:string){return allowedImageTitle(title);}
export function sourceImageDate(title:string):string|undefined {
 const iso=title.match(/\b(20\d{2})[-_](0[1-9]|1[0-2])(?:[-_](0[1-9]|[12]\d|3[01]))?\b/);if(iso)return iso[1]+"-"+iso[2]+(iso[3]?"-"+iso[3]:"");
 const month=title.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:\d{1,2},?\s+)?(20\d{2})\b/i);
 if(month)return month[2]+"-"+String(["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(month[1].slice(0,3).toLowerCase())+1).padStart(2,"0");
}
export async function extractDocumentVisual(bytes:Uint8Array,title:string,deadline=Date.now()+90000):Promise<{image:Buffer;page?:number;approval:ImageCheck}|undefined>{
 if(forbiddenImageDocument.test(title)||isPrivateDocument(title))return;
 if(!Buffer.from(bytes.subarray(0,1024)).includes(Buffer.from("%PDF-"))){
  if(!previewCandidate(title))return;
  const image=await sharp(bytes,{limitInputPixels:25000000}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer();
  const approval=await classifyImagePage(image,title,sourceImageDate(title));
  return approvedImageCheck(approval)?{image,approval}:undefined;
 }
 rendererReady ??= definePDFJSModule(()=>import("pdfjs-dist/legacy/build/pdf.mjs"));await rendererReady;
 const pdf=await getDocumentProxy(bytes.slice(),{wasmUrl:join(pdfAssets,"wasm")+"/",standardFontDataUrl:join(pdfAssets,"standard_fonts")+"/",cMapUrl:join(pdfAssets,"cmaps")+"/",cMapPacked:true});
 try{
  for(let page=1;page<=Math.min(pdf.numPages,40);page++){
   if(Date.now()>deadline-46000)break;
   const p=await pdf.getPage(page),text=(await p.getTextContent()).items.map(i=>"str" in i?i.str:"").join(" ");
   if(forbiddenImageDocument.test(text)||isPrivateDocument(text))continue;
   // A report is a container. Only an explicitly titled exhibit page may be a candidate.
   const pageTitle=allowedImageTitle(title)?title:text.slice(0,350);
   if(!allowedImageTitle(pageTitle))continue;
   const image=await sharp(new Uint8Array(await renderPageAsImage(pdf,page,{canvasImport:()=>import("@napi-rs/canvas"),width:1600}))).webp({quality:82}).toBuffer();
   const approval=await classifyImagePage(image,pageTitle,sourceImageDate(title));
   if(approvedImageCheck(approval))return {page,image,approval};
  }
 }finally{await (pdf as unknown as {destroy?:()=>Promise<void>}).destroy?.();}
}
export async function documentPreview(jurisdiction:string,bytes:Uint8Array,title:string,sourceUrl:string,deadline?:number):Promise<MapVisual|undefined>{
 if(forbiddenImageDocument.test(title))return;
 const id=createHash("sha256").update(IMAGE_CHECK_VERSION).update(jurisdiction).update(sourceUrl).update(title).update(bytes).digest("hex");
 let asset=await readVisualAsset(jurisdiction,id);
 if(!approvedImageCheck(asset?.approval)){
  const result=await extractDocumentVisual(bytes,title,deadline);if(!result)return;
  asset={image:result.image.toString("base64"),page:result.page,approval:result.approval};await saveVisualAsset(jurisdiction,id,asset);
 }
 const src="/api/maps/"+jurisdiction+"/visual/"+id;
 return {approval:asset!.approval,documentTitle:title,src,fullSizeUrl:src,sourceUrl:sourceUrl+(asset!.page&&!sourceUrl.includes("#/plan/")?"#page="+asset!.page:""),label:imageCaption(asset!.approval!),alt:imageCaption(asset!.approval!),kind:asset!.approval!.type==="vicinity/aerial exhibit"?"context":"proposal"};
}
export async function refreshCaseVisual(config:JurisdictionConfig,hearing:Hearing,deadline:number,reports:{label:string;url:string}[]=[]):Promise<MapVisual|undefined>{
  for(const report of [...reports,...hearing.meetings.flatMap(m=>m.staffReports??[])].slice(0,2)){
    if(Date.now()>deadline-8000)break;
    try{const visual=await documentPreview(config.id,await downloadDocument(report.url,config.id),report.label,report.url,deadline);if(visual)return visual;}catch{console.error("[map-visual] Report image unavailable",hearing.appId);}
  }
  const client=config.recordClient;
  if(hearing.energovPlanId&&client?.downloadPublicAttachment){
    const files=await client.getPlanAttachments(hearing.energovPlanId).catch(()=>{console.error("[map-visual] City file list unavailable",hearing.appId);return [];});
    const candidates=files.filter(f=>!f.IsFileSecure&&previewCandidate(f.FileName+" "+(f.Notes??""))).sort((a,b)=>Number(proposal.test(b.FileName))-Number(proposal.test(a.FileName)));
    for(const file of candidates.slice(0,3)){
      if(Date.now()>deadline-8000)break;
      try{const bytes=await client.downloadPublicAttachment(file.AttachmentID);const source=client.planPortalUrl(hearing.energovPlanId,"attachments");const visual=await documentPreview(config.id,bytes,file.FileName,source,deadline);if(visual)return visual;}catch{console.error("[map-visual] Public image unavailable",hearing.appId);}
    }
  }
}
