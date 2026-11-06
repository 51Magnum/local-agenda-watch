import {verifyBoundarySource,collectionCoverage} from "./boundary-source";
import {retainRecentOrHeard} from "./collection-window";
import {difference,feature,featureCollection,simplify} from "@turf/turf";
import {jurisdiction} from "./registry";
import {SourceHttp,SourceFailure} from "./http";
import {arcgisAdapter,applicationAdapter} from "./adapters/arcgis";
import {agendaProgress,collectAgendas} from "./agenda-progress";
import {claimCollectionProgress} from "./collection-progress-store";
import {geolocateApplications,coverageEligible} from "./application-geolocation";
import {nativeSampleAllowed} from "./native-sample";
import {allowedAttachment} from "./adapters/common";
import type {CaseGeometry} from "../maps/types";
import {combinePolygons,polygonGeometry} from "../maps/gis";
import {readStaging,saveStaging,type StagingSnapshot} from "./store";
import {matchSignupEvents,parseTentativeTable} from "./participation-sources";
import {applicationScope,individualApplicant} from "./application-scope";
import {groupApplications} from "./application-groups";
import {matchApplications} from "./matching";
import {discoverStagingLibraries} from "./libraries";
import {accountForAgenda,assertCollectionComplete,projectNumber} from "./agenda-projects";
export function sourceHttp(areaId:string,deadline?:number,concurrency=1){const d=jurisdiction(areaId);if(!d)throw Error("Unknown jurisdiction");const urls=[d.boundary.url,...[d.recordLinks?.verifyUrlTemplate,d.applications.recordUrlTemplate].filter(Boolean) as string[],...Object.values(d.gis),...d.agenda.map(a=>String(a.params.baseUrl)),String(d.applications.params.url??""),...(d.area.timeline?.hosts??[]).map(h=>"https://"+h),d.participation.testimonySignupUrl??"",d.clipRule?.layer.url??"",...([d.applications.params.geometryJoin,d.applications.params.addressPointFallback].filter(Boolean) as {url:string}[]).map(s=>s.url)];return new SourceHttp({deadline,concurrency,redirects:d.recordLinks?.redirects,allowedHosts:[...new Set(urls.filter(Boolean).map(u=>new URL(u!).hostname))],maxBytes:d.documents.maxBytes});}
type CollectOptions={days?:number;write?:boolean;selfCheck?:boolean;budgetMs?:number;http?:SourceHttp;now?:Date};
export async function collectJurisdiction(areaId:string,options:CollectOptions={}){
 if(!jurisdiction(areaId)?.enabled)throw Error("Jurisdiction is disabled or unknown");
 const lease=options.write?await claimCollectionProgress(areaId):undefined;
 try{return await collectWithProgress(areaId,options,lease);}finally{await lease?.release();}
}
async function collectWithProgress(areaId:string,options:CollectOptions,lease?:Awaited<ReturnType<typeof claimCollectionProgress>>){
 const d=jurisdiction(areaId);if(!d||!d.enabled)throw Error("Jurisdiction is disabled or unknown");
 const now=options.now??new Date(),days=options.days??90;if(!Number.isInteger(days)||days<1||days>90)throw Error("Backfill window must be between 1 and 90 days");
 const range={start:new Date(now.getTime()-days*86400000).toISOString().slice(0,10),end:new Date(now.getTime()+45*86400000).toISOString().slice(0,10)},deadline=Date.now()+(options.budgetMs??140000),http=options.http??sourceHttp(areaId,deadline),old=await readStaging(areaId);
 const snapshot:StagingSnapshot={areaId,launchStatus:d.launchStatus,checkedAt:now.toISOString(),range,applications:[],meetings:(old?.meetings??[]).filter(m=>m.date>=range.start&&m.date<=range.end),pendingMeetings:[],health:http.checks,skipped:[],complete:true,aiSamples:old?.aiSamples??[],visuals:old?.visuals,runtime:old?.runtime};
 try{snapshot.applications=await applicationAdapter(d,http,{geolocate:false}).listApplications();}catch(e){snapshot.complete=false;snapshot.applications=old?.applications??[];if(!(e instanceof SourceFailure))snapshot.skipped.push({url:String(d.applications.params.url),reason:String(e)});}
 if(snapshot.applications.some(a=>a.geolocationDeferred))snapshot.complete=false;
 const progress=agendaProgress(d,range,now,lease?.previous),resumed=progress===lease?.previous;
 const agendas=await collectAgendas(d,range,http,deadline,progress,lease?.save);
 snapshot.checkedAt=progress.startedAt;
 snapshot.collectionProgress={resumed,completedMeetings:agendas.completedMeetings,pendingMeetings:agendas.pendingMeetings.length,phase:agendas.complete?"finalize":"agendas"};
 snapshot.pendingMeetings=agendas.pendingMeetings;snapshot.skipped.push(...agendas.skipped);
 snapshot.meetings.push(...agendas.meetings);
 // No staging/publication mutation and no expensive GIS work for a partial agenda cycle.
 if(!agendas.complete){snapshot.complete=false;return snapshot;}
 snapshot.meetings=[...new Map(snapshot.meetings.map(m=>[m.body+":"+m.date+":"+m.meetingPageUrl,m])).values()];
 if(d.participation.signupUrlRule==="umbracoEvents"&&d.participation.signupEventsUrl){try{const url=d.participation.signupEventsUrl.replace("{start}",range.start).replace("{end}",range.end),events=await http.json<{Events:{title:string;start:string;url:string}[]}>(url);snapshot.meetings=matchSignupEvents(d,snapshot.meetings,events.Events??[],url);}catch{snapshot.complete=false;}}
 for(const source of d.agenda)if(source.params.hearingsUrl&&source.params.scheduleYear&&source.params.scheduleTables){try{const url=String(source.params.hearingsUrl);snapshot.calendarHints=parseTentativeTable(await http.text(url),url,Number(source.params.scheduleYear),source.params.scheduleTables as {index:number;body:string}[]);}catch{snapshot.complete=false;}}
 await discoverStagingLibraries(snapshot,Math.min(deadline-20000,Date.now()+30000));
 for(const m of snapshot.meetings)for(const a of [...m.attachments,...m.items.flatMap(i=>i.attachments)])if(!allowedAttachment(a,d))snapshot.skipped.push({url:a.url,reason:a.kind==="packet"?"Compiled meeting packet excluded from AI":nativeSampleAllowed(a,d)?"Large report queued for bounded native/page-image sample; remaining pages deferred":a.sizeBytes&&a.sizeBytes>d.documents.maxBytes?"Attachment exceeds native download cap":"Private attendance material excluded",bytes:a.sizeBytes});
 try{const gis=arcgisAdapter(http),boundaryData=await gis.query(d.boundary.url,d.boundary.where);verifyBoundarySource(d.boundary,boundaryData);const boundary=combinePolygons(boundaryData.features);if(!boundary)throw Error("Boundary source has no polygons");snapshot.boundary=simplify(feature(boundary),{tolerance:.00005,highQuality:true}).geometry;
  if(d.clipRule){const cities=(await gis.query(d.clipRule.layer.url,d.clipRule.layer.where)).features.filter(f=>polygonGeometry(f.geometry)).map(f=>simplify(feature(f.geometry as CaseGeometry),{tolerance:.00005,highQuality:true}));const clipped=difference(featureCollection([feature(snapshot.boundary),...cities]));if(!clipped)throw Error("County clipping produced no coverage");snapshot.coverageBoundary=clipped.geometry;}
  snapshot.boundarySource={url:d.boundary.url,where:d.boundary.where};
  if(d.gis.impactAreas)snapshot.impactAreas=await gis.query(d.gis.impactAreas);
 }catch(e){snapshot.complete=false;snapshot.boundary=old?.boundary;snapshot.coverageBoundary=old?.coverageBoundary;snapshot.boundarySource=old?.boundarySource;if(!(e instanceof SourceFailure))snapshot.skipped.push({url:d.boundary.url,reason:String(e)});}
 const sourceRows=snapshot.applications.length;
 snapshot.applications=groupApplications(d,snapshot.applications);
 // County public eligibility is controlled by the clipped coverage, never by a postal city.
 for(const meeting of snapshot.meetings)for(const item of meeting.items)item.matchedApplications=matchApplications(item,snapshot.applications);
 for(const meeting of snapshot.meetings)for(const item of meeting.items)for(const match of item.matchedApplications??[]){const app=snapshot.applications.find(a=>a.recordId===match.recordId);if(app)app.relatedCaseNumbers=[...new Set([...app.relatedCaseNumbers,...item.caseNumbers.filter(id=>projectNumber(d,id)&&projectNumber(d,id)===app.projectNumber)])];}
 const linked=new Set(snapshot.meetings.flatMap(m=>m.items.flatMap(i=>i.matchedApplications?.map(a=>a.recordId)??[])));
 if(!d.legacyPublic)snapshot.applications=retainRecentOrHeard(snapshot.applications,linked,range.start);
 snapshot.applications=await geolocateApplications(d,snapshot.applications,arcgisAdapter(http));
 if(snapshot.applications.some(a=>a.geolocationDeferred))snapshot.complete=false;
 // Geometry intersection is bounded to the retained inventory, not all historic filings.
 const coverage=collectionCoverage(d,snapshot);
 if(d.clipRule&&coverage)snapshot.applications=snapshot.applications.flatMap(a=>{const eligible=coverageEligible(a,coverage);return eligible?[eligible]:[];});
 snapshot.collectionStats={sourceRows,projectsBeforeScope:snapshot.applications.length,excludedByScope:0};
 const beforeScope=snapshot.applications;
 snapshot.applications=applicationScope(d,snapshot.applications,snapshot.meetings);
 snapshot.exclusions={};for(const a of beforeScope.filter(a=>!snapshot.applications.some(b=>b.recordId===a.recordId))){const category=(individualApplicant(a.sourceFields[String(d.applications.params.applicantField??"")])?"Individual staff permit: ":"Outside hearing/development scope: ")+(a.type||"Unspecified type");snapshot.exclusions[category]=(snapshot.exclusions[category]??0)+1;}
 snapshot.collectionStats.excludedByScope=snapshot.collectionStats.projectsBeforeScope-snapshot.applications.length;
 const allCases=new Set(snapshot.applications.flatMap(a=>[a.recordId,...a.relatedCaseNumbers]));
 for(const meeting of snapshot.meetings)for(const item of meeting.items)item.caseNumbers=item.caseNumbers.filter(id=>allCases.has(id)||d.caseNumberPatterns.some(p=>new RegExp(p,"i").test(id)));
 if(!d.legacyPublic)accountForAgenda(d,snapshot);
 if(options.write){if(!snapshot.complete)return snapshot;assertCollectionComplete(snapshot,old);await saveStaging(snapshot);await lease?.clear();if(!d.legacyPublic&&options.selfCheck!==false)await(await import("./run-self-check")).runSelfCheck(areaId,{snapshot,previous:old,reports:false});}return snapshot;
}
