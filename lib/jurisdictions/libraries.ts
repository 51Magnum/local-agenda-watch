import {walkLibrary} from "../timeline/libraries";
import {allowedSource} from "../timeline/source-access";
import {getEvidenceStore,type EvidenceStore} from "../timeline/store";
import {attachmentKind} from "./adapters/common";
import type {StagingSnapshot} from "./store";
/** Only explicit links associated with an agenda case are traversed. The existing
 * walker owns persistent folder queues and prefers final agency reports. */
export async function discoverStagingLibraries(snapshot:StagingSnapshot,deadline:number,store:EvidenceStore=getEvidenceStore()){
 for(const meeting of snapshot.meetings)for(const item of meeting.items){
  const caseId=item.caseNumbers[0];if(!caseId)continue;
  for(const root of [...item.attachments].filter(a=>/\.sharepoint\.com|Browse\.aspx|\/libraries\//i.test(a.url))){
   if(Date.now()>deadline){snapshot.complete=false;snapshot.skipped.push({url:root.url,reason:"Nested document traversal deferred; queue retained for the next run"});continue;}
   if(!allowedSource(root.url,snapshot.areaId)){snapshot.complete=false;snapshot.skipped.push({url:root.url,reason:"Linked document library host must be verified in the jurisdiction configuration"});continue;}
   try{for(const f of await walkLibrary(snapshot.areaId,caseId,root.url,store,deadline))if(!item.attachments.some(a=>a.url===f.url))item.attachments.push({title:f.title,url:f.url,kind:attachmentKind(f.title,f.url)});}catch(e){snapshot.complete=false;snapshot.skipped.push({url:root.url,reason:"Library access blocked or unavailable: "+String(e)});}
  }
 }
}
