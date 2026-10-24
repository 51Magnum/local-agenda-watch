import{createRecordAreaPages}from "./record-pages";
import{getCanyonCountyHearings}from "@/lib/localities/canyon-county";
import{COUNTY_PORTAL,countyTitle,countySummary,countyStage,type CountyCase}from "@/lib/sources/canyon-county";
const pages=createRecordAreaPages({areaId:"canyon-county",loadFeed:getCanyonCountyHearings,record:h=>(h as CountyCase).county,title:countyTitle,summary:countySummary,stage:countyStage,sourceLabel:"County GIS and Land Hearings Agenda",sourceUrl:COUNTY_PORTAL+"/Landing",dataWindow:"Active applications, filings and decisions since January of the previous year, plus cases found in recent hearing records. Older history is available in County records."});
export const CountyHub=pages.hub,CountyCasePage=pages.case,CountyCaseMetadata=pages.caseMetadata,CountyMeetings=pages.meetings,CountyCalendar=pages.caseCalendar;
