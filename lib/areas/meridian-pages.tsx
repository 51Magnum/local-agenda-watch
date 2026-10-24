import{createRecordAreaPages}from "./record-pages";
import{getMeridianHearings}from "@/lib/localities/meridian";
import{meridianTitle,meridianSummary,meridianStage,meridianRecordUrl,MERIDIAN_NOTICES,type MeridianCase}from "@/lib/sources/meridian";
import {denverInstant} from "@/lib/case-details";
import type {RecordEvent,RecordDocument}from "@/lib/localities/record-types";
import type {Hearing}from "@/lib/localities/types";
function record(h:Hearing){const m=(h as MeridianCase).meridian;
 const events:RecordEvent[]=h.meetings.map((e,i)=>({id:h.appId+"-"+e.body+"-"+e.date+"-"+i,caseIds:[h.appId],name:meridianTitle(h),address:"",body:e.body,date:e.date,time:e.time,startsAt:e.time?denverInstant(e.date,e.time,"America/Denver"):e.date,sourceUrl:e.sourceUrl,linkedIds:[],documents:[]}));
 for(const e of events){const source=h.meetings.find(s=>s.body===e.body&&s.date===e.date);if(source?.agendaUrl)e.documents.push({label:"Agenda",filename:e.body+" · "+e.date,url:source.agendaUrl,sourceUrl:e.sourceUrl});if(source?.minutesUrl)e.documents.push({label:"Minutes — motions & votes",filename:e.body+" · "+e.date,url:source.minutesUrl,sourceUrl:e.sourceUrl});if(source?.videoUrl)e.documents.push({label:"Meeting recording",filename:e.body+" · "+e.date,url:source.videoUrl,sourceUrl:e.sourceUrl});if(source?.packetUrl)e.documents.push({label:"Meeting packet",filename:e.body+" · "+e.date,url:source.packetUrl,sourceUrl:e.sourceUrl});}
 // A GIS outcome is shown only as a dated official action, never inferred from Active or Appr_Date alone.
 if(h.decisionRecorded&&m.actionDate)events.push({id:h.appId+"-decision",caseIds:[h.appId],name:meridianTitle(h),address:"",body:m.authority,date:m.actionDate,startsAt:m.actionDate,result:m.action,sourceUrl:meridianRecordUrl(h),linkedIds:[],documents:[]});
 const files=m.notices.at(-1)?.filesUrl??h.externalUrl;
 const documents:RecordDocument[]=files?[{label:"Official application materials",filename:"City Laserfiche folder",url:files,sourceUrl:MERIDIAN_NOTICES}]:[];
 events.sort((a,b)=>a.date.localeCompare(b.date));
 return {sourceUrl:meridianRecordUrl(h),documents,reviewDate:/accepted/i.test(m.workflowStatus)?m.workflowDate:undefined,address:m.notices.at(-1)?.description.match(/(?:generally )?located at (.+?)(?:Applicant:|$)/i)?.[1]?.split(/\bin the (?:east|west|north|south)|\bsection \d|\bT\.\d/i)[0]?.replace(/[.\s]+$/,"")??"",decisionDate:h.decisionRecorded?m.actionDate:undefined,events:events.filter(e=>e.date),sourceStatus:m.active?"Active":"Inactive",approvalStatus:m.action};
}
const pages=createRecordAreaPages({areaId:"meridian",groupMeetings:true,loadFeed:getMeridianHearings,record,title:meridianTitle,summary:meridianSummary,stage:meridianStage,sourceLabel:"City GIS, public hearing notices and meeting archive",sourceUrl:MERIDIAN_NOTICES,dataWindow:"Active applications and applications from the previous year onward. The linked city archive contains older records.",facts:h=>({variant:"nonresidential",request:{value:h.appTypeLabel,url:meridianRecordUrl(h)}})});
export const MeridianHub=pages.hub,MeridianCasePage=pages.case,MeridianCaseMetadata=pages.caseMetadata,MeridianMeetings=pages.meetings,MeridianCalendar=pages.caseCalendar;
