import {bbox} from "@turf/turf";
import type {Hearing,HearingFeed} from "../localities/types";
import type {PublicCaseRecord,RecordEvent} from "../localities/record-types";
import type {MapSnapshot,CaseGeometry} from "../maps/types";
import {geometryCentroid} from "../maps/spatial";
import {polygonGeometry} from "../maps/gis";
import {cleanResidentTitle} from "../resident-copy";
import type {JurisdictionDefinition} from "./types";
import type {Application,Meeting} from "./adapters/types";
import type {StagingSnapshot} from "./store";
import {applicationScope} from "./application-scope";
import {protectMapCase} from "../residential-privacy";
import {groupApplications} from "./application-groups";
import {jurisdiction} from "./registry";
import {applicationRecordUrl} from "./application-source";
import {applicationTitle} from "./application-copy";
export type ConfiguredHearing=Hearing&{record:PublicCaseRecord};
export function stagedApplications(snapshot:StagingSnapshot):Application[]{
 const d=jurisdiction(snapshot.areaId);return applicationScope(d,groupApplications(d,snapshot.applications),snapshot.meetings);
}
export function displayStagedApplication(d:JurisdictionDefinition,a:Application):Application{
 const fields=d.applications.params.fields as Record<string,string>??{};
 return{...a,recordUrl:applicationRecordUrl(d,a.recordId,a.projectNumber),sourceUrl:applicationRecordUrl(d,a.recordId,a.projectNumber),...a.residentialPrivacy?{name:"Residential permit request",description:"A residential permit request. Review the official record for the proposed activity.",address:"",parcel:[]}: {},type:String(a.sourceFields[fields.type]??a.type??"Planning application").trim()||"Planning application",status:String(a.sourceFields[fields.status]??a.status??"").trim()};
}
export function stagedAppearances(snapshot:StagingSnapshot,a:Application){const ids=[a.recordId,...a.relatedCaseNumbers];return snapshot.meetings.filter(m=>m.items.some(i=>i.caseNumbers.some(id=>ids.includes(id))||i.matchedApplications?.some(match=>match.recordId===a.recordId)));}
const documents=(m:Meeting,a:Application)=>{if(a.residentialPrivacy)return [];const ids=[a.recordId,...a.relatedCaseNumbers];return m.items.filter(i=>i.caseNumbers.some(id=>ids.includes(id))||i.matchedApplications?.some(match=>match.recordId===a.recordId)).flatMap(i=>i.attachments.filter(f=>f.kind!=="packet").map(f=>({label:f.title,filename:f.title,url:f.url,sourceUrl:m.meetingPageUrl})));};
export function stagedFeed(d:JurisdictionDefinition,snapshot:StagingSnapshot):HearingFeed{
 const active:ConfiguredHearing[]=stagedApplications(snapshot).map(raw=>{
  const a=displayStagedApplication(d,raw),appearances=stagedAppearances(snapshot,a);
  const events:RecordEvent[]=appearances.map(m=>({id:m.id,caseIds:[a.recordId],name:m.title,address:"",body:d.hearingBodies.find(b=>b.key===m.body)?.name??m.title,date:m.date,startsAt:m.startsAt??m.date,sourceUrl:m.meetingPageUrl,documents:documents(m,a),linkedIds:[]}));
  return{appId:a.recordId,displayTitle:applicationTitle(a.type,a.description||a.name),appType:a.type,appTypeLabel:cleanResidentTitle(a.type),appStatus:a.status,appPhase:"Review",appPhaseRaw:"Review",appScope:a.description||null,description:a.description,appAcres:null,externalUrl:a.recordUrl,energovPlanId:null,meetings:appearances.map(m=>({body:d.hearingBodies.find(b=>b.key===m.body)?.name??m.title,bodyLabel:m.title,date:m.date,dateLabel:m.date,time:m.startsAt?new Intl.DateTimeFormat("en-GB",{timeZone:d.timezone,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(m.startsAt)):undefined,location:"Confirm location in the official meeting record",sourceUrl:m.meetingPageUrl,agendaUrl:m.meetingPageUrl,continuedNote:null,staffReports:documents(m,a).map(f=>({label:f.label,url:f.url}))})),record:{sourceUrl:a.recordUrl,address:a.address,appliedDate:a.received,sourceStatus:a.status,approvalStatus:"",documents:events.flatMap(e=>e.documents),events}};
 });
 return{active,completed:[],refreshedAt:snapshot.checkedAt,scheduleRefreshedAt:snapshot.checkedAt,scheduleUnavailable:!snapshot.complete,agendaMeetings:snapshot.meetings.map(m=>({id:m.id,title:m.title,body:m.body,bodyLabel:m.title,date:m.date,dateLabel:m.date,sourceUrl:m.meetingPageUrl,meetingUrl:m.meetingPageUrl,items:m.items.map(i=>({itemNumber:i.itemId,title:i.title,caseIds:i.caseNumbers,agendaUrl:m.meetingPageUrl,staffReports:i.attachments.filter(a=>a.kind==="staff_report").map(a=>({label:a.title,url:a.url}))}))}))};
}
export function stagedMapSnapshot(d:JurisdictionDefinition,snapshot:StagingSnapshot):MapSnapshot{
 const feed=stagedFeed(d,snapshot),applications=stagedApplications(snapshot),today=new Date().toISOString().slice(0,10);
 return{version:1,jurisdiction:d.id,updatedAt:snapshot.checkedAt,warnings:[],cases:feed.active.map(h=>{
  const a=applications.find(a=>a.recordId===h.appId)!,geometry=a.geometry&&polygonGeometry(a.geometry)?a.geometry as CaseGeometry:null;
  const next=h.meetings.filter(m=>m.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
  return protectMapCase(d.id,{id:h.appId,residentialPrivacy:a.residentialPrivacy,areaId:d.id,title:h.displayTitle??h.appId,summary:h.description??"",type:h.appType,typeLabel:h.appTypeLabel,recordStatus:h.appStatus,stage:next?/board|council/i.test(next.body)?"Council/Board":"P&Z":"In review",href:`/${d.area.country}/${d.state}/${d.id}/plan/${encodeURIComponent(h.appId)}`,geometry,centroid:geometry?geometryCentroid(geometry):null,bounds:geometry?bbox(geometry).slice(0,4) as [number,number,number,number]:undefined,source:geometry?"polygon":"none",sourceUrl:a.sourceUrl,confidence:geometry?"exact":"approximate",citywide:false,flumCategories:[],parcelIds:a.parcel,...next?{nextHearing:{date:next.date,body:next.body,label:next.body+" · "+next.date}}:{}});
 })};
}
export function configuredRecord(h:Hearing):PublicCaseRecord{return(h as ConfiguredHearing).record??{sourceUrl:h.externalUrl??undefined,address:"",sourceStatus:h.appStatus,approvalStatus:"",events:[],documents:[]};}
