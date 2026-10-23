import { join } from "node:path";
const pdfAssets = join(process.cwd(),"node_modules","pdfjs-dist");
import { createHash } from "node:crypto";
import sharp from "sharp";
import { extractImages, getDocumentProxy, renderPageAsImage, definePDFJSModule } from "unpdf";
import { isPrivateDocument } from "@/lib/case-details";
import { readVisualAsset, saveVisualAsset } from "./visual-store";
import type { MapVisual, JurisdictionConfig } from "./types";
import type { Hearing } from "@/lib/localities/types";
import { downloadDocument } from "@/lib/timeline/ingest";
let rendererReady: Promise<void> | undefined;
const proposal = /site[\s_-]*plan|concept|prelim(?:inary)?[\s_-]*plat|landscape[\s_-]*plan/i;
const context = /aerial|vicinity[\s_-]*map|zoning[\s_-]*map|land[\s_-]*use[\s_-]*map/i;
export function previewCandidate(title:string){return !isPrivateDocument(title)&&/\.(?:pdf|png|jpe?g|webp)(?:$|\s|[?])/i.test(title)&&(/\.(?:png|jpe?g|webp)(?:$|\s)/i.test(title)||proposal.test(title)||context.test(title)||/staff[\s_-]*report/i.test(title));}
export async function extractDocumentVisual(bytes:Uint8Array,title:string):Promise<{image:Buffer;page?:number}|undefined>{
  if(isPrivateDocument(title))return;
  if(!Buffer.from(bytes.subarray(0,1024)).includes(Buffer.from("%PDF-"))){
    const image=await sharp(bytes,{limitInputPixels:25000000}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer();
    return {image};
  }
  rendererReady ??= definePDFJSModule(()=>import("pdfjs-dist/legacy/build/pdf.mjs"));
  await rendererReady;
  const pdf=await getDocumentProxy(bytes.slice(),{wasmUrl:join(pdfAssets,"wasm")+"/",standardFontDataUrl:join(pdfAssets,"standard_fonts")+"/",cMapUrl:join(pdfAssets,"cmaps")+"/",cMapPacked:true});
  try{
    const pages:{page:number;rank:number}[]=[];
    for(let page=1;page<=Math.min(pdf.numPages,40);page++){
      const p=await pdf.getPage(page),text=(await p.getTextContent()).items.map(i=>"str" in i?i.str:"").join(" ");
      if(isPrivateDocument(text))continue;
      if(proposal.test(text))pages.push({page,rank:0});
      else if(context.test(text))pages.push({page,rank:1});
      else if(proposal.test(title)||context.test(title))pages.push({page,rank:2});
    }
    for(const p of pages.sort((a,b)=>a.rank-b.rank||a.page-b.page).slice(0,12)){
      const images=await extractImages(pdf,p.page);
      const image=images.filter(i=>i.width>=320&&i.height>=200&&i.width*i.height>=120000&&i.width*i.height<=25000000).sort((a,b)=>b.width*b.height-a.width*a.height)[0];
      if(!image&&!proposal.test(title)&&!context.test(title))continue;
      return {page:p.page,image:await sharp(new Uint8Array(await renderPageAsImage(pdf,p.page,{canvasImport:()=>import("@napi-rs/canvas"),width:1600}))).webp({quality:82}).toBuffer()};
    }
  }finally{await (pdf as unknown as {destroy?:()=>Promise<void>}).destroy?.();}
}
export async function documentPreview(jurisdiction:string,bytes:Uint8Array,title:string,sourceUrl:string):Promise<MapVisual|undefined>{
  const id=createHash("sha256").update("full-page-preview-v4").update(jurisdiction).update(sourceUrl).update(title).update(bytes).digest("hex");
  let asset=await readVisualAsset(jurisdiction,id);
  if(!asset){const result=await extractDocumentVisual(bytes,title);if(!result)return;asset={image:result.image.toString("base64"),page:result.page};await saveVisualAsset(jurisdiction,id,asset);}
  const src="/api/maps/"+jurisdiction+"/visual/"+id;
  return {documentTitle:title,src,fullSizeUrl:src,sourceUrl:sourceUrl+(asset.page&&!sourceUrl.includes("#/plan/")?"#page="+asset.page:""),label:"City file image"+(asset.page?" · page "+asset.page:""),alt:"Image extracted from "+title,kind:"context",note:"From a city file; see the source for its date and context. It may show an earlier version."};
}
export async function refreshCaseVisual(config:JurisdictionConfig,hearing:Hearing,deadline:number,reports:{label:string;url:string}[]=[]):Promise<MapVisual|undefined>{
  for(const report of [...reports,...hearing.meetings.flatMap(m=>m.staffReports??[])].slice(0,2)){
    if(Date.now()>deadline-8000)break;
    try{const visual=await documentPreview(config.id,await downloadDocument(report.url),report.label,report.url);if(visual)return visual;}catch{console.error("[map-visual] Report image unavailable",hearing.appId);}
  }
  const client=config.recordClient;
  if(hearing.energovPlanId&&client?.downloadPublicAttachment){
    const files=await client.getPlanAttachments(hearing.energovPlanId).catch(()=>{console.error("[map-visual] City file list unavailable",hearing.appId);return [];});
    const candidates=files.filter(f=>!f.IsFileSecure&&previewCandidate(f.FileName+" "+(f.Notes??""))).sort((a,b)=>Number(proposal.test(b.FileName))-Number(proposal.test(a.FileName)));
    for(const file of candidates.slice(0,3)){
      if(Date.now()>deadline-8000)break;
      try{const bytes=await client.downloadPublicAttachment(file.AttachmentID);const source=client.planPortalUrl(hearing.energovPlanId,"attachments");const visual=await documentPreview(config.id,bytes,file.FileName,source);if(visual)return visual;}catch{console.error("[map-visual] Public image unavailable",hearing.appId);}
    }
  }
}
