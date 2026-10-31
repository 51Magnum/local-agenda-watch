import "server-only";
import {officialGisLink} from "../jurisdictions/official-gis-link";
import {routeJurisdictions,publicJurisdictions} from "../jurisdictions/registry";
import {registryBoundaries} from "../jurisdictions/generated";
import {readReviewSnapshot} from "../jurisdictions/review-snapshot";
import {isPreview} from "../runtime-environment";
import { recordPageOnHosts, type RecordPageContext } from "./record-links";
import type { MultiPolygon, Polygon } from "geojson";
export type AreaDefinition = {
  color?:string; id:string; slug:string; country:string; countryName:string; state:string; stateName:string; stateAbbreviation:string;
  name:string; type:"city"|"county"; status:"live"|"coming soon"; timezone:string;
  center:[number,number]; boundary:Polygon|MultiPolygon; boundaryLabel:string; boundarySources:string[]; coverageBoundary?:Polygon|MultiPolygon; coverageNote?:string;
  bodies:{additional?:{id:string;label:string;shortLabel:string;stageLabel:string}[];planning:{id:string;label:string;shortLabel:string;stageLabel:string};decision:{id:string;label:string;shortLabel:string;stageLabel:string}};
  meetingRules:{defaultHearingTime?:string;decisionCommentDeadlineHour?:number;agendaNotice:string;commentInstructions:string;location?:string};
  commentInstructionsUrl?:string;
  timeline?:{adapter:"energov-primegov"|"county"|"meridian"|"municipal";hosts:string[];storage?:{host:string;pathPrefix:string}[];documentRules:readonly {kind:"staff-report"|"pz-decision"|"council-decision"|"findings"|"minutes";pattern:string}[]};
  residentAccess?:{excludedHosts:string[];archiveUrl:string;commentUrl?:string;caseRecords?:Record<string,string[]>};
  recordPage?:(context:RecordPageContext)=>string|undefined;
  addressSearch?:{addressField:string;where:string;suffix:string};
  flumCompatibility?:{
    zoningCodePattern:string;
    categories:Record<string,{districts:string[];sourceUrl:string}>;
  };
  sources:{cases?:string;hearingsSchedule?:string;geometry?:string[];flum?:string;agendas?:string;addressPoints?:string;parcelFallback?:string};
};
const ROUTE_AREAS:Record<string,AreaDefinition>=Object.fromEntries(routeJurisdictions().map(d=>{
 if(isPreview()){const review=readReviewSnapshot(d.id);return review?[d.id,review.area]:[];}
 const boundary=registryBoundaries[d.id+":boundary"] as AreaDefinition["boundary"]|undefined;
 if(!boundary){if(d.legacyPublic)throw Error("Published jurisdiction has no verified boundary cache: "+d.id);return [];}
 const hosts=d.recordPageHosts;
 return [d.id,{...d.area,...!d.legacyPublic?{color:d.color,boundarySources:d.area.boundarySources.map(url=>officialGisLink(url)!)}:{},id:d.id,slug:d.id,name:d.name,type:d.type,state:d.state,status:"live",timezone:d.legacyPublic?"America/Denver":d.timezone,boundary,
 ...(registryBoundaries[d.id+":coverageBoundary"]?{coverageBoundary:registryBoundaries[d.id+":coverageBoundary"] as AreaDefinition["boundary"]}:{}),
 ...(hosts?{recordPage:(context:RecordPageContext)=>recordPageOnHosts(context,hosts)}:{})}];
}).filter(row=>row.length));
export const AREAS:Record<string,AreaDefinition>=Object.fromEntries(publicJurisdictions().map(d=>[d.id,ROUTE_AREAS[d.id]]));
export const FEATURED_AREA_ID="nampa";
export async function visibleAreas(){
 if(isPreview())return publicJurisdictions().flatMap(d=>{const area=readReviewSnapshot(d.id)?.area;if(!area)return [];ROUTE_AREAS[d.id]=area;AREAS[d.id]=area;return [area];});
 return (await Promise.all(routeJurisdictions().map(async d=>{
  if(d.legacyPublic)return ROUTE_AREAS[d.id];
  try{const snapshot=await(await import("../jurisdictions/self-check-store")).readPublished(d.id);if(!snapshot?.boundary){delete AREAS[d.id];return;}
   const area:AreaDefinition={...d.area,id:d.id,slug:d.id,name:d.name,type:d.type,state:d.state,status:"live",timezone:d.timezone,color:d.color,boundary:snapshot.boundary,coverageBoundary:snapshot.coverageBoundary};
   ROUTE_AREAS[d.id]=area;AREAS[d.id]=area;return area;
  }catch{return;}
 }))).filter((a):a is AreaDefinition=>!!a);
}
export function getArea(id:string){return Object.hasOwn(ROUTE_AREAS,id)?ROUTE_AREAS[id]:undefined;}
export function findArea(country:string,state:string,slug:string){return Object.values(ROUTE_AREAS).find(a=>a.country===country&&a.state===state&&a.slug===slug);}
export function areaPath(area:Pick<AreaDefinition,"country"|"state"|"slug">|string){const a=typeof area==="string"?getArea(area):area;return a?`/${a.country}/${a.state}/${a.slug}`:"/"+area;}
export function canonicalAreaHref(id:string,path:string){const a=getArea(id);if(!a)return path;const old="/"+id;return path===old||path.startsWith(old+"/")||path.startsWith(old+"?")||path.startsWith(old+"#")?areaPath(a)+path.slice(old.length):path;}
export function stageLabel(stage:string,area:Pick<AreaDefinition,"bodies">){return stage.startsWith("P&Z hearing")?area.bodies.planning.stageLabel+stage.slice("P&Z hearing".length):stage.startsWith("Council hearing")?area.bodies.decision.stageLabel+stage.slice("Council hearing".length):stage;}
export function mapStageLabel(stage:string,area?:AreaDefinition){return stage==="P&Z"?area?.bodies.planning.shortLabel??"Planning":stage==="Council/Board"?area?.bodies.decision.shortLabel??"Decision body":stage;}
export function bodyLabel(body:string,area:Pick<AreaDefinition,"bodies">){return body===area.bodies.planning.id?area.bodies.planning.label:body===area.bodies.decision.id?area.bodies.decision.label:body;}

/** Builders stay on the server; React client props contain data only. */
export function publicArea(area:AreaDefinition):Omit<AreaDefinition,"recordPage"> {
 const data={...area};delete data.recordPage;return data;
}
