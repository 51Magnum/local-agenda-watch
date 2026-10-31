import {extractNativePdfChunk} from "../timeline/extract";
import type {PageText} from "../timeline/types";
import {allowedAttachment} from "./adapters/common";
import type {Attachment} from "./adapters/types";
import type {JurisdictionDefinition} from "./types";
import type {SourceHttp} from "./http";
export const nativeDownloadLimit=(d:JurisdictionDefinition)=>d.documents.maxNativeBytes??d.documents.maxBytes;
export function nativeSampleAllowed(a:Attachment,d:JurisdictionDefinition){return a.kind==="staff_report"&&allowedAttachment(a,{...d,documents:{...d.documents,maxBytes:nativeDownloadLimit(d)}});}
/** A larger native download is never an authorization to send the full PDF to AI. */
export async function readNativeSample(http:SourceHttp,a:Attachment,d:JurisdictionDefinition,deadline:number){
 if(!nativeSampleAllowed(a,d))throw Error("Report excluded by native sample limits or privacy policy");
 const {bytes}=await http.request(a.url,{},nativeDownloadLimit(d));
 if(new TextDecoder().decode(bytes.subarray(0,5))!=="%PDF-")throw Error("Official report is not a PDF");
 const chunk=await extractNativePdfChunk(bytes.slice(),{deadline:Math.min(deadline-40000,Date.now()+25000),maxPages:Math.min(12,d.documents.maxPages)});
 const pages:PageText[]=[];let chars=0;
 for(const p of chunk.pages.filter(p=>p.text.trim().length>30)){if(chars+p.text.length>20000)break;pages.push(p);chars+=p.text.length;}
 return {bytes,pages,chunk};
}
