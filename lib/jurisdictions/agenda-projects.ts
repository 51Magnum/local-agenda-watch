import type {JurisdictionDefinition} from "./types";

import type {StagingSnapshot} from "./store";
import {matchApplications} from "./matching";
export function projectNumber(d:JurisdictionDefinition,id:string){
 const key=d.applications.params.projectKey as {pattern:string}|undefined;
 return key?id.match(new RegExp(key.pattern))?.[0]:undefined;
}
/** Shared hearings relate projects; they never change either project's identity. */
export function accountForAgenda(d:JurisdictionDefinition,snapshot:StagingSnapshot){
 for(const meeting of snapshot.meetings)for(const item of meeting.items){
  if(meeting.tentative)continue;
  item.matchedApplications=matchApplications(item,snapshot.applications);
  for(const id of item.caseNumbers){
   let app=snapshot.applications.find(a=>a.recordId===id||a.relatedCaseNumbers.includes(id));
   if(!app){const number=projectNumber(d,id);app=number?snapshot.applications.find(a=>a.projectNumber===number):undefined;}
   if(!app){
    const source=item.itemUrl??meeting.meetingPageUrl;
    app={recordId:id,projectNumber:projectNumber(d,id),relatedCaseNumbers:[],name:item.title,type:"",description:item.title,status:"Official hearing item",address:"",parcel:[],recordUrl:source,sourceUrl:source,sourceFields:{agendaOnly:true},agendaOnly:true};
    snapshot.applications.push(app);
   }
   if(id!==app.recordId&&!app.relatedCaseNumbers.includes(id))app.relatedCaseNumbers.push(id);
   if(!item.matchedApplications.some(m=>m.recordId===app!.recordId))item.matchedApplications.push({recordId:app.recordId,method:"case",sourceUrl:app.recordUrl});
  }
 }
}
export function hearingLinkedCount(snapshot:StagingSnapshot){return new Set(snapshot.meetings.filter(m=>!m.tentative).flatMap(m=>m.items.flatMap(i=>i.matchedApplications?.map(a=>a.recordId)??[]))).size;}
export function assertCollectionComplete(snapshot:StagingSnapshot,previous?:StagingSnapshot){
 if(!snapshot.complete)throw Error("Collection incomplete; previous staging retained");
 if(previous&&hearingLinkedCount(previous)>0&&hearingLinkedCount(snapshot)<hearingLinkedCount(previous)*.7)throw Error("Hearing-linked records fell more than 30%; previous staging retained");
}
