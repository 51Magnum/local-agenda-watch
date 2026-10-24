import { CountyHub,CountyCasePage,CountyCaseMetadata,CountyMeetings,CountyCalendar } from "./canyon-county-pages";
import type { Metadata } from "next";
import type { AreaDefinition } from "./registry";
import { findArea,areaPath } from "./registry";
import { notFound } from "next/navigation";
import Hub from "@/app/nampa/page";
import CasePage,{generateMetadata as caseMetadata} from "@/app/nampa/plan/[planNumber]/page";
import Meetings from "@/app/nampa/meetings/page";
import Braeburn,{metadata as braeburnMetadata} from "@/app/nampa/braeburn-creek/page";
import { GET as caseCalendar } from "@/app/nampa/plan/[planNumber]/hearing.ics/route";
import { GET as projectCalendar } from "@/app/nampa/braeburn-creek/hearing.ics/route";
export type AreaParams={country:string;state:string;area:string};
export function routeArea(p:AreaParams){const area=findArea(p.country,p.state,p.area);if(!area)notFound();return area;}
// Area adapters own their source-specific pages; shared routes contain no city assumptions.
export const AREA_ADAPTERS:Record<string,{hub:typeof Hub;case:typeof CasePage;caseMetadata:typeof caseMetadata;meetings:typeof Meetings;projects:Record<string,typeof Braeburn>;projectMetadata:Record<string,Metadata>;caseCalendar:typeof caseCalendar;projectCalendar:typeof projectCalendar}>={"canyon-county":{hub:CountyHub,case:CountyCasePage,caseMetadata:CountyCaseMetadata,meetings:CountyMeetings,projects:{},projectMetadata:{},caseCalendar:CountyCalendar,projectCalendar},nampa:{hub:Hub,case:CasePage,caseMetadata,meetings:Meetings,projects:{"braeburn-creek":Braeburn},projectMetadata:{"braeburn-creek":braeburnMetadata},caseCalendar,projectCalendar}};
export function areaMetadata(area:AreaDefinition,suffix=""){const base=areaPath(area);const title=area.status!=="live"?area.name+", "+area.stateAbbreviation+" — Coming soon | Local Agenda Watch":area.name+", "+area.stateAbbreviation+" Rezoning & Public Hearing Tracker | Local Agenda Watch";return {title:{absolute:title},description:"Development proposals, public hearings and decisions in "+area.name+", "+area.stateName+". Independent summaries linked to official records.",alternates:{canonical:"https://www.localagendawatch.com"+base+suffix},openGraph:{title,description:"Explore local development proposals and public hearings.",url:"https://www.localagendawatch.com"+base+suffix,images:["https://www.localagendawatch.com"+base+"/opengraph-image"]}};}
