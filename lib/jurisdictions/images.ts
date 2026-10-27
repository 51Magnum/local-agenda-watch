import {jurisdiction} from "./registry";
import {readStaging,saveStaging} from "./store";
import {sourceHttp} from "./collect";
import {allowedAttachment} from "./adapters/common";
import {withJurisdictionAi} from "./ai-budget";
import {documentPreview} from "../maps/visuals";
export async function replacePrivateImage(areaId:string,caseId:string,url?:string){
 const d=jurisdiction(areaId),snapshot=await readStaging(areaId);if(!d||!snapshot)throw Error("Unknown staged jurisdiction");
 if(!url){if(snapshot.visuals)delete snapshot.visuals[caseId];await saveStaging(snapshot);return{removed:true};}
 const app=snapshot.applications.find(a=>a.recordId===caseId||a.relatedCaseNumbers.includes(caseId)),ids=[caseId,...app?[app.recordId,...app.relatedCaseNumbers]:[]];
 const candidate=snapshot.meetings.flatMap(m=>m.items).filter(i=>i.caseNumbers.some(c=>ids.includes(c))).flatMap(i=>i.attachments).find(a=>a.url===url&&allowedAttachment(a,d));
 if(!candidate)throw Error("Choose an official document already associated with this case");
 const bytes=(await sourceHttp(areaId).request(url,{},d.documents.maxBytes)).bytes;
 const visual=await withJurisdictionAi({areaId,mode:"monthly"},()=>documentPreview(areaId,bytes,candidate.title,url,Date.now()+180000));
 if(!visual)throw Error("No approved image found; discovery/review remains pending");
 (snapshot.visuals??={})[caseId]={...visual,label:"Image from "+candidate.title+" · "+visual.label};await saveStaging(snapshot);return{updated:true,source:visual.sourceUrl};
}
