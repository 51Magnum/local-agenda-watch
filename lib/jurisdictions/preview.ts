import {booleanIntersects,feature} from "@turf/turf";
import {cleanResidentProse} from "../resident-copy";
import type {PaneData} from "../maps/project-questions";
import {applicationMapLocation} from "./application-geolocation";
import {getEvidenceStore} from "../timeline/store";
import {publicFields,evidenceSourceHref} from "../timeline/types";
import {questionEvidence} from "../maps/project-questions";
import {jurisdiction} from "./registry";
import {readStaging,type StagingSnapshot} from "./store";
import {projectHearingState} from "./hearing-state";
import {officialFeatureLink} from "./official-gis-link";
import type {Meeting} from "./adapters/types";
import {documentLabel} from "./document-label";
import {polygonGeometry} from "../maps/gis";
import {displayStagedApplication,stagedApplications} from "./resident-records";
import {applicationTitle} from "./application-copy";
import {jurisdictionToday} from "./hearing-state";
export async function privateProject(areaId:string,caseId:string,publishedSnapshot?:StagingSnapshot,options:{evidence?:boolean}={}):Promise<PaneData|undefined>{
 const d=jurisdiction(areaId),snapshot=publishedSnapshot??await readStaging(areaId);if(!d||!snapshot)return;
 const rawApp=stagedApplications(snapshot).find(a=>a.recordId===caseId||a.relatedCaseNumbers.includes(caseId));
 const app=rawApp?displayStagedApplication(d,rawApp):undefined;
 const ids=[...new Set([caseId,...app?[app.recordId,...app.relatedCaseNumbers]:[]])];
 const appearances=snapshot.meetings.filter(m=>m.items.some(i=>(i.caseNumbers.some(id=>ids.includes(id))||i.matchedApplications?.some(a=>ids.includes(a.recordId))))).sort((a,b)=>a.date.localeCompare(b.date));
 const agendaItem=appearances.flatMap(m=>m.items).find(i=>i.caseNumbers.some(id=>ids.includes(id))&&!/\.pdf$|^\d{9}(?:-[A-Z]+)*$/i.test(i.title));
 if(!app&&!agendaItem)return;
 const meetingSource=(meeting:Meeting)=>meeting.items.find(i=>i.caseNumbers.some(id=>ids.includes(id))||i.matchedApplications?.some(a=>ids.includes(a.recordId)))?.itemUrl??meeting.meetingPageUrl;
 const hearing=projectHearingState(d,appearances,snapshot.checkedAt),next=hearing.next,source=app?.recordUrl??agendaItem?.itemUrl??appearances.at(-1)!.meetingPageUrl;
 const title=app?.selfCheckTitle??applicationTitle(app?.type??"Planning application",app?.description||app?.name||agendaItem!.title);
 const location=app?applicationMapLocation(app):{geometry:null,centroid:null,confidence:"approximate" as const,source:"none" as const},geometry=location.geometry;
 let evidence:ReturnType<typeof questionEvidence>|undefined;let approvedSummary:string|undefined;let approvedSummarySource:string|undefined;
 if(options.evidence!==false)try{const store=getEvidenceStore(),state=store.readCase?await store.readCase(areaId,ids):await store.read();const fields=publicFields(state,ids,areaId);const summaryField=fields.filter(f=>["popupExplanation","requestSummary"].includes(f.key)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];approvedSummary=summaryField?.value;approvedSummarySource=summaryField?evidenceSourceHref(summaryField):undefined;evidence=questionEvidence(fields,{...d.area,id:areaId,timezone:d.timezone} as never);}catch{}
 const rawVisual=ids.map(id=>snapshot.visuals?.[id]).find(Boolean),visual=rawVisual?{...rawVisual,src:rawVisual.src.replace("/api/maps/","/admin/jurisdictions/"),fullSizeUrl:rawVisual.fullSizeUrl.replace("/api/maps/","/admin/jurisdictions/")}:undefined;
 const deadlines=hearing.deadlines,written=deadlines.find(r=>r.kind==="written");
 const impactArea=app?.geometry&&polygonGeometry(app.geometry)&&geometry&&snapshot.impactAreas?.features.find(f=>f.geometry&&polygonGeometry(f.geometry)&&booleanIntersects(feature(geometry),feature(f.geometry)));
 const impacts=[...evidence?.impacts??[],...(impactArea?[{label:"Area of City Impact",value:"The official parcel overlaps the mapped Area of City Impact for "+String(impactArea.properties?.City??impactArea.properties?.CITY??"a city")+". The case remains with "+d.name+".",url:officialFeatureLink(d.gis.impactAreas,impactArea.properties,impactArea.id)}]:[])];
 const relatedCases=[...new Map(appearances.flatMap(m=>m.items.filter(i=>i.matchedApplications?.some(a=>ids.includes(a.recordId))).flatMap(i=>(i.matchedApplications??[]).filter(a=>!ids.includes(a.recordId)).map(a=>[a.recordId,{areaId,caseId:a.recordId,href:"/admin/jurisdictions/"+areaId+"/project/"+encodeURIComponent(a.recordId),label:"Heard together"}] as const)))).values()];
 return{relatedCases,noHearing:hearing.noHearing,aiSummaryPending:!approvedSummary,area:{id:areaId,name:(d.type==="city"?"City of ":"")+d.name,timezone:d.timezone,planningBody:d.area.bodies.planning.label,decisionBody:d.area.bodies.decision.label},item:{id:app?.recordId??caseId,aiTitle:app?.aiTitle,privacyPolicy:app?.privacyPolicy,residentialPrivacy:app?.residentialPrivacy,title,type:app?.type??"Planning application",typeLabel:app?.type??"Planning application",summary:app?.description??agendaItem?.title??"",stage:next?(d.hearingBodies.find(b=>b.key===next.body)?.role==="deciding"?"Council/Board":"P&Z"):"In review",href:"/admin/jurisdictions/"+areaId+"/project/"+encodeURIComponent(app?.recordId??caseId),...location,sourceUrl:app?.geometrySourceUrl??source,citywide:false,flumCategories:[],visual,popup:{projectName:title,headline:app?.type??"Planning application",explanation:approvedSummary?cleanResidentProse(approvedSummary):(app?.description??agendaItem?.title??""),aiGenerated:!!approvedSummary,progress:[{label:app?.status??"Official hearing item",state:"current"}]}},caseIds:ids,summarySource:approvedSummarySource??source,where:app?.geometrySource==="address-point"?app.address+" · Approximate (address point)":app?.address||"Location not published",history:[...(app?.received?[{label:"Received · "+app.received,source:app.recordUrl}]:[]),...appearances.filter(m=>m.date<jurisdictionToday(d.timezone)).map(m=>({label:m.title+" agenda · "+m.date+"; outcome not established",source:meetingSource(m)}))],next:next?{body:next.title,startsAt:next.startsAt??next.date,location:"Confirm location in the official meeting record",sourceUrl:meetingSource(next),meeting_url:meetingSource(next),role:"Item authority must be verified in the official report",commentDeadline:written?.startsAt,commentSourceUrl:written?.sourceUrl,speak_signup_url:next.testimonySignupUrl??d.participation.testimonySignupUrl}:undefined,impacts,conditions:evidence?.conditions??[],conditionsSource:evidence?.conditionsSource,commentUrl:hearing.commentUrl,commentInstructions:deadlines.map(r=>r.kind+": "+r.date+" · "+r.label).join("; "),documents:app?.residentialPrivacy||app?.hiddenDocuments?[]:[...new Map(appearances.flatMap(m=>m.items.filter(i=>(i.caseNumbers.some(id=>ids.includes(id))||i.matchedApplications?.some(a=>ids.includes(a.recordId)))).flatMap(i=>i.attachments.filter(a=>a.kind!=="packet").map(a=>[a.url,{label:/\.pdf$/i.test(a.title)?documentLabel(a.kind):a.title,url:a.url}] as const)))).values()],officialRecords:[{label:/MapServer|FeatureServer/.test(source)?"County GIS data":"Official application record",url:source}],updatedAt:snapshot.checkedAt,lastCheckedAt:snapshot.checkedAt};
}
