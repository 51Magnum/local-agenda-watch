import {booleanIntersects,feature} from "@turf/turf";
import {cleanResidentProse} from "../resident-copy";
import type {PaneData} from "../maps/project-questions";
import type {CaseGeometry} from "../maps/types";
import {geometryCentroid} from "../maps/spatial";
import {getEvidenceStore} from "../timeline/store";
import {publicFields,evidenceSourceHref} from "../timeline/types";
import {questionEvidence} from "../maps/project-questions";
import {jurisdiction} from "./registry";
import {readStaging} from "./store";
import {projectHearingState} from "./hearing-state";
import {adaDocumentLabel} from "./adapters/ada-agenda";
import {polygonGeometry} from "../maps/gis";
import {displayStagedApplication,stagedApplications} from "./resident-records";
import {applicationTitle} from "./application-copy";
export async function privateProject(areaId:string,caseId:string):Promise<PaneData|undefined>{
 const d=jurisdiction(areaId),snapshot=await readStaging(areaId);if(!d||!snapshot)return;
 const rawApp=stagedApplications(snapshot).find(a=>a.recordId===caseId||a.relatedCaseNumbers.includes(caseId));
 const app=rawApp?displayStagedApplication(d,rawApp):undefined;
 const ids=[...new Set([caseId,...app?[app.recordId,...app.relatedCaseNumbers]:[]])];
 const appearances=snapshot.meetings.filter(m=>m.items.some(i=>(i.caseNumbers.some(id=>ids.includes(id))||i.matchedApplications?.some(a=>ids.includes(a.recordId))))).sort((a,b)=>a.date.localeCompare(b.date));
 const agendaItem=appearances.flatMap(m=>m.items).find(i=>i.caseNumbers.some(id=>ids.includes(id))&&!/\.pdf$|^\d{9}(?:-[A-Z]+)*$/i.test(i.title));
 if(!app&&!agendaItem)return;
 const hearing=projectHearingState(d,appearances,snapshot.checkedAt),next=hearing.next,source=app?.recordUrl??appearances.at(-1)!.meetingPageUrl;
 const title=applicationTitle(app?.type??"Planning application",app?.description||app?.name||agendaItem!.title);
 const geometry=app?.geometry&&polygonGeometry(app.geometry)?app.geometry as CaseGeometry:null;
 let evidence:ReturnType<typeof questionEvidence>|undefined;let approvedSummary:string|undefined;let approvedSummarySource:string|undefined;
 try{const store=getEvidenceStore(),state=store.readCase?await store.readCase(areaId,ids):await store.read();const fields=publicFields(state,ids,areaId);const summaryField=fields.filter(f=>["popupExplanation","requestSummary"].includes(f.key)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];approvedSummary=summaryField?.value;approvedSummarySource=summaryField?evidenceSourceHref(summaryField):undefined;evidence=questionEvidence(fields,{...d.area,id:areaId,timezone:d.timezone} as never);}catch{}
 const rawVisual=ids.map(id=>snapshot.visuals?.[id]).find(Boolean),visual=rawVisual?{...rawVisual,src:rawVisual.src.replace("/api/maps/","/admin/jurisdictions/"),fullSizeUrl:rawVisual.fullSizeUrl.replace("/api/maps/","/admin/jurisdictions/")}:undefined;
 const deadlines=hearing.deadlines,written=deadlines.find(r=>r.kind==="written");
 const impactArea=geometry&&snapshot.impactAreas?.features.find(f=>f.geometry&&polygonGeometry(f.geometry)&&booleanIntersects(feature(geometry),feature(f.geometry)));
 const impacts=[...evidence?.impacts??[],...(impactArea?[{label:"Area of City Impact",value:"Within "+String(impactArea.properties?.City??impactArea.properties?.CITY??"a mapped city")+" Area of City Impact. The case remains with "+d.name+".",url:d.gis.impactAreas}]:[])];
 return{noHearing:hearing.noHearing,aiSummaryPending:!approvedSummary,area:{id:areaId,name:(d.type==="city"?"City of ":"")+d.name,timezone:d.timezone,planningBody:d.area.bodies.planning.label,decisionBody:d.area.bodies.decision.label},item:{id:app?.recordId??caseId,residentialPrivacy:app?.residentialPrivacy,title,type:app?.type??"Planning application",typeLabel:app?.type??"Planning application",summary:app?.description??agendaItem?.title??"",stage:next?"P&Z":"In review",href:"/admin/jurisdictions/"+areaId+"/project/"+encodeURIComponent(app?.recordId??caseId),geometry,centroid:geometry?geometryCentroid(geometry):null,source:geometry?"polygon":"none",confidence:geometry?"exact":"approximate",citywide:false,flumCategories:[],visual,popup:{projectName:title,headline:app?.type??"Planning application",explanation:approvedSummary?cleanResidentProse(approvedSummary):(app?.description??agendaItem?.title??""),aiGenerated:!!approvedSummary,progress:[{label:app?.status??"Official hearing item",state:"current"}]}},caseIds:ids,summarySource:approvedSummarySource??source,where:app?.address||undefined,history:[...(app?.received?[{label:"Received · "+app.received,source:app.recordUrl}]:[]),...appearances.filter(m=>m.date<new Date().toISOString().slice(0,10)).map(m=>({label:m.title+" agenda · "+m.date+"; outcome not established",source:m.meetingPageUrl}))],next:next?{body:next.title,startsAt:next.startsAt??next.date,location:"Confirm location in the official meeting record",sourceUrl:next.meetingPageUrl,meeting_url:next.meetingPageUrl,role:"Item authority must be verified in the official report",commentDeadline:written?.startsAt,commentSourceUrl:written?.sourceUrl,speak_signup_url:next.testimonySignupUrl??d.participation.testimonySignupUrl}:undefined,impacts,conditions:evidence?.conditions??[],conditionsSource:evidence?.conditionsSource,commentUrl:hearing.commentUrl,commentInstructions:deadlines.map(r=>r.kind+": "+r.date+" · "+r.label).join("; "),documents:app?.residentialPrivacy?[]:[...new Map(appearances.flatMap(m=>m.items.filter(i=>(i.caseNumbers.some(id=>ids.includes(id))||i.matchedApplications?.some(a=>ids.includes(a.recordId)))).flatMap(i=>i.attachments.filter(a=>a.kind!=="packet").map(a=>[a.url,{label:/\.pdf$/i.test(a.title)?adaDocumentLabel(a.kind):a.title,url:a.url}] as const)))).values()],officialRecords:[{label:"Official application record",url:source}],updatedAt:snapshot.checkedAt,lastCheckedAt:snapshot.checkedAt};
}
