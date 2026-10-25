import {join} from "node:path";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {getDocumentProxy,renderPageAsImage,definePDFJSModule} from "unpdf";
import {classifyImagePage} from "./classify-image";
import {allowedImageTitle,forbiddenImageDocument,approvedImageCheck,type ImageCheck} from "./image-policy";
export type PageCandidate={page:number;title:string;score:number};
export type DocumentScan={hash:string;nextPage:number;candidates:PageCandidate[];classified:number[];complete:boolean;previousCaption?:string;inCase?:boolean;matched?:boolean;retryAt?:string};
export type ScanResult={page?:number;image:Buffer;approval:ImageCheck};
let ready:Promise<void>|undefined;
export function visualPriority(title:string){return /site[ _-]*plan/i.test(title)?0:/concept|plat/i.test(title)?1:/landscape/i.test(title)?2:/elevation|rendering/i.test(title)?3:/vicinity|aerial/i.test(title)?4:5;}
export function pageCaption(parts:string[]){
 const caption=parts.find(s=>s.length<180&&forbiddenImageDocument.test(s)&&/sign[ _-]*in|neighborhood meeting|attendance|affidavit|mailing list|comment letter|^\s*(?:notice (?:of|public)|application form|form)\b/i.test(s));
 if(caption&&parts.slice(0,12).includes(caption))return caption;
 return [...parts].filter(s=>s.length<100&&s.split(/\s+/).length<=12&&!/\bshall|must|submit|should|recommend|without\b/i.test(s)&&allowedImageTitle(s)).sort((a,b)=>visualPriority(a)-visualPriority(b))[0];
}
export function graphicsScore(text:string,ops:{fnArray:ArrayLike<number>;argsArray:unknown[]},codes:Record<string,number>){
 let images=0,paths=0,largest=0;for(let i=0;i<ops.fnArray.length;i++){const n=ops.fnArray[i];if([codes.paintImageXObject,codes.paintInlineImageXObject,codes.paintImageXObjectRepeat].includes(n)){images++;const args=ops.argsArray[i] as unknown[]|undefined;largest=Math.max(largest,Number(args?.[1]??0)*Number(args?.[2]??0));}if([codes.constructPath,codes.stroke,codes.fill,codes.eoFill,codes.fillStroke].includes(n))paths++;}
 // A single full-page scan must not lose to a map tiled into dozens of bitmaps.
 return ((images?70:0)+(largest>=2000000?220:0)+Math.log2(paths+1)*20) / (1+text.length/10000);

}
export async function scanDocumentVisuals(bytes:Uint8Array,title:string,options:{deadline:number;analyzeOnly?:boolean;sourceDate?:string;caseId?:string;packet?:boolean;progress?:DocumentScan;checkpoint?:(scan:DocumentScan)=>Promise<void>;candidate?:(result:ScanResult)=>Promise<void>}):Promise<{complete:boolean;progress:DocumentScan;best?:ScanResult}>{
 const hash=createHash("sha256").update(bytes).digest("hex");
 const progress=options.progress?.hash===hash?options.progress:{hash,nextPage:1,candidates:[],classified:[],complete:false};
 const save=async()=>options.checkpoint?.(progress);
 if(forbiddenImageDocument.test(title)){progress.complete=true;await save();return {complete:true,progress};}
 let best:ScanResult|undefined;
 if(!Buffer.from(bytes.subarray(0,1024)).includes(Buffer.from("%PDF-"))){
  if(allowedImageTitle(title)&&Date.now()<options.deadline-1000){const image=await sharp(bytes,{limitInputPixels:25000000}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer();const approval=await classifyImagePage(image,title,options.sourceDate,options.deadline);const result={image,approval};await options.candidate?.(result);if(approvedImageCheck(approval))best=result;progress.complete=!["unchecked","classification unavailable"].includes(approval.type);}else progress.complete=!allowedImageTitle(title);
  await save();return {complete:progress.complete,progress,best};
 }
 ready??=definePDFJSModule(()=>import("pdfjs-dist/legacy/build/pdf.mjs"));await ready;
 const {OPS}=await import("pdfjs-dist/legacy/build/pdf.mjs");const assets=join(process.cwd(),"node_modules","pdfjs-dist");
 const pdf=await getDocumentProxy(bytes.slice(),{wasmUrl:join(assets,"wasm")+"/",standardFontDataUrl:join(assets,"standard_fonts")+"/",cMapUrl:join(assets,"cmaps")+"/",cMapPacked:true});
 try{
  for(let page=progress.nextPage;page<=pdf.numPages;page++){
   if(Date.now()>=options.deadline-1500){await save();return {complete:false,progress};}
   const p=await pdf.getPage(page),parts=(await p.getTextContent()).items.map(i=>"str" in i?i.str:"").filter(Boolean),text=parts.join(" ");
   // Packets are containers for unrelated cases: only a case's own contiguous section is eligible.
   let eligible=true;
   if(options.packet&&options.caseId){const ids=[...new Set(text.match(/\b(?:H|SHP|ZOA|CPAM|PUD|FP|PP|AZ|CUP)-\d{4}-\d{4}\b/g)??[])];if(ids.includes(options.caseId)&&ids.length<=2){progress.inCase=true;progress.matched=true;}else if(ids.length&& !ids.includes(options.caseId))progress.inCase=false;eligible=progress.inCase===true;}
   const caption=pageCaption(parts),previous=progress.previousCaption;
   if(eligible&&(!caption||!forbiddenImageDocument.test(caption))){
    const ops=await p.getOperatorList(),score=graphicsScore(text,ops,OPS);
    const candidateTitle=caption??(previous&&allowedImageTitle(previous)?previous:allowedImageTitle(title)?title:"Map or plan exhibit");
    if(score>=8||(caption&&text.length<2000&&allowedImageTitle(caption))||(!options.packet&&allowedImageTitle(title))){progress.candidates.push({page,title:candidateTitle,score:score+(caption?180-visualPriority(candidateTitle)*25:0)});progress.candidates.sort((a,b)=>b.score-a.score||a.page-b.page);progress.candidates=progress.candidates.slice(0,8);}
   }
   progress.previousCaption=caption;progress.nextPage=page+1;p.cleanup();if(page%10===0)await save();
  }
  await save();
  if(options.analyzeOnly)return {complete:false,progress};
  // At most eight full pages per document go to vision. No cropping before privacy review.
  for(const c of progress.candidates){if(progress.classified.includes(c.page))continue;if(Date.now()>=options.deadline-1000){await save();return {complete:false,progress,best};}
   const image=await sharp(new Uint8Array(await renderPageAsImage(pdf,c.page,{canvasImport:()=>import("@napi-rs/canvas"),width:1600}))).webp({quality:82}).toBuffer();
   const approval=await classifyImagePage(image,c.title,options.sourceDate,options.deadline),result={page:c.page,image,approval};await options.candidate?.(result);
   if(!["unchecked","classification unavailable"].includes(approval.type))progress.classified.push(c.page);else progress.retryAt=new Date(Date.parse(approval.checkedAt)+86400000).toISOString();
   if(approvedImageCheck(approval)&&(!best||visualPriority(approval.type)<visualPriority(best.approval.type)))best=result;
   await save();
  }
  progress.complete=progress.candidates.every(c=>progress.classified.includes(c.page));await save();return {complete:progress.complete,progress,best};
 }finally{await (pdf as unknown as {destroy?:()=>Promise<void>}).destroy?.();}
}
