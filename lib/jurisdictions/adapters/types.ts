import type {Geometry} from "geojson";
export type SourceHealth={url:string;state:"ok"|"blocked"|"unavailable"|"skipped";status?:number;latencyMs:number;bytes?:number;records?:number;reason?:string;checkedAt:string};
export type Attachment={title:string;url:string;kind:"staff_report"|"agenda"|"packet"|"minutes"|"memo"|"findings"|"other";sizeBytes?:number};
export type AgendaItem={matchedApplications?:import("../matching").ApplicationMatch[];itemId:string;title:string;caseNumbers:string[];body:string;meetingDateTime:string;meetingPageUrl:string;attachments:Attachment[];itemUrl?:string};
export type Meeting={id:string;title:string;body:string;date:string;startsAt?:string;meetingPageUrl:string;attachments:Attachment[];items:AgendaItem[];tentative?:boolean;testimonySignupUrl?:string};
export type Application={recordId:string;relatedCaseNumbers:string[];name:string;type:string;status:string;address:string;parcel:string[];geometry?:Geometry;description:string;received?:string;recordUrl:string;sourceUrl:string;sourceFields:Record<string,unknown>;decision?:{value:string;date?:string;sourceUrl:string}};
export type DateRange={start:string;end:string};
export interface AgendaAdapter {listMeetings(range:DateRange):Promise<Meeting[]>;getMeeting(id:string):Promise<Meeting>;healthcheck():Promise<SourceHealth[]>}
export interface ApplicationAdapter {listApplications(since?:string):Promise<Application[]>;getApplication(id:string):Promise<Application|undefined>;healthcheck():Promise<SourceHealth[]>}
export interface GisAdapter {query(url:string,where?:string):Promise<import("geojson").FeatureCollection<Geometry|null>>;metadata(url:string):Promise<Record<string,unknown>>}
