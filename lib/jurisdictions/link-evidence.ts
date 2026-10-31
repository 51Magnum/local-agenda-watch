import {createHash} from "node:crypto";
import {getDocumentProxy} from "unpdf";
import {filenameIdentifies,officialDocument} from "./record-links";
import {attachmentKind} from "./adapters/common";
import {projectNumber} from "./agenda-projects";
import type {SourceHttp} from "./http";
import type {JurisdictionDefinition} from "./types";
import type {StagingSnapshot} from "./store";
import type {LinkEvidence} from "./self-check";
/** Identity reads are bounded to three physical pages, independently of AI budgets. */
export async function pdfIdentity(bytes:Uint8Array,deadline:number){
 const pdf=await getDocumentProxy(bytes.slice());const pages:string[]=[];
 try{for(let n=1;n<=Math.min(3,pdf.numPages);n++){
  if(Date.now()>deadline)break;const page=await pdf.getPage(n),content=await page.getTextContent();
  pages.push(content.items.map(i=>"str" in i?i.str:"").join(" "));page.cleanup();await pdf.cleanup();
 }return pages.join("\n");}finally{await pdf.loadingTask.destroy();}
}
export function linkReader(d:JurisdictionDefinition,snapshot:StagingSnapshot,http:SourceHttp,deadline:number){
 return async(url:string):Promise<LinkEvidence>=>{
  if(Date.now()>deadline)throw Error("Source verification deferred to next refresh");
  const refs=snapshot.meetings.flatMap(m=>m.items.flatMap(i=>i.attachments.filter(a=>a.url===url).map(a=>({a,i}))));
  const ids=refs.flatMap(({i})=>i.caseNumbers.map(id=>projectNumber(d,id)??id));
  if(refs.length&&officialDocument(d,url)&&filenameIdentifies(d,url,ids)&&refs.every(({a})=>d.documents.countyAuthoredKinds?.includes(attachmentKind(a.title,a.url)))){
   // The configured official filename is sufficient identity evidence. HEAD proves
   // availability without downloading a 160+ MB report or copying its private text.
   const head=await http.request(url,{method:"HEAD"},Number.MAX_SAFE_INTEGER);
   if(/application\/pdf/i.test(head.headers["content-type"]??""))return {status:head.health.status===304?200:head.health.status??0,text:"",evidenceHash:createHash("sha256").update(JSON.stringify([url,refs.map(({a})=>[a.kind,a.sizeBytes]),head.headers.etag,head.headers["last-modified"],head.headers["content-length"]])).digest("hex")};
  }
  const data=await http.request(url,{},d.documents.maxNativeBytes??d.documents.maxBytes);let text=new TextDecoder().decode(data.bytes),documentHash:string|undefined;
  if(text.startsWith("%PDF")){
   documentHash=createHash("sha256").update(data.bytes).digest("hex");
   try{text=await pdfIdentity(data.bytes,Math.min(deadline,Date.now()+15000));if(!text.trim())return {status:200,text:"",documentHash,readable:false,reason:"Could not read the first three PDF pages; retry next refresh, no owner action required."};}
   catch{return {status:200,text:"",documentHash,readable:false,reason:"Could not read the PDF; retry next refresh, no owner action required."};}
  }
  return {status:data.health.status===304?200:data.health.status??0,text,documentHash};
 };
}
