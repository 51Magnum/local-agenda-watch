import{createRecordAreaPages}from "./record-pages";
import{getMeridianHearings}from "@/lib/localities/meridian";
import{meridianTitle,meridianSummary,meridianStage,meridianRecordUrl,MERIDIAN_NOTICES}from "@/lib/sources/meridian";


import{meridianPublicRecord as record}from"@/lib/sources/meridian-record";

const pages=createRecordAreaPages({areaId:"meridian",groupMeetings:true,loadFeed:getMeridianHearings,record,title:meridianTitle,summary:meridianSummary,stage:meridianStage,sourceLabel:"City GIS, public hearing notices and meeting archive",sourceUrl:MERIDIAN_NOTICES,dataWindow:"Active applications and applications from the previous year onward. The linked city archive contains older records.",facts:h=>({variant:"nonresidential",request:{value:h.appTypeLabel,url:meridianRecordUrl(h)}})});
export const MeridianHub=pages.hub,MeridianCasePage=pages.case,MeridianCaseMetadata=pages.caseMetadata,MeridianMeetings=pages.meetings,MeridianCalendar=pages.caseCalendar;
