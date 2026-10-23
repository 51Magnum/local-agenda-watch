import type { MultiPolygon, Polygon } from "geojson";
import nampaBoundary from "./boundaries/nampa.json";
import canyonBoundary from "./boundaries/canyon-county.json";
export type AreaDefinition = {
  id:string; slug:string; country:string; countryName:string; state:string; stateName:string; stateAbbreviation:string;
  name:string; type:"city"|"county"; status:"live"|"coming soon"; timezone:string;
  center:[number,number]; boundary:Polygon|MultiPolygon; boundaryLabel:string; boundarySources:string[];
  bodies:{planning:{id:string;label:string;shortLabel:string;stageLabel:string};decision:{id:string;label:string;shortLabel:string;stageLabel:string}};
  meetingRules:{defaultHearingTime?:string;decisionCommentDeadlineHour?:number;agendaNotice:string;commentInstructions:string;location?:string};
  commentInstructionsUrl?:string;
  sources:{cases?:string;hearingsSchedule?:string;geometry?:string[];flum?:string;agendas?:string;addressPoints?:string;parcelFallback?:string};
};
const cityData="https://utility.arcgis.com/usrsvcs/servers/3543690ae3bf41a1a77b9b9b2bc477ca/rest/services/Public/NampaOpenData/MapServer";
const hearings="https://utility.arcgis.com/usrsvcs/servers/757f490738bd43da906508745cf92337/rest/services/Public/PZ_Hearings/MapServer";
export const AREAS:Record<string,AreaDefinition>={
  nampa:{id:"nampa",slug:"nampa",country:"us",countryName:"United States",state:"id",stateName:"Idaho",stateAbbreviation:"ID",name:"Nampa",type:"city",status:"live",timezone:"America/Denver",center:[-116.5635,43.5739],boundary:nampaBoundary as MultiPolygon,boundaryLabel:"City limits and official area of impact",boundarySources:[cityData+"/6",cityData+"/12"],
    bodies:{planning:{id:"P&Z",label:"Planning & Zoning Commission",shortLabel:"P&Z",stageLabel:"P&Z hearing"},decision:{id:"City Council",label:"City Council",shortLabel:"Council",stageLabel:"Council hearing"}},
    meetingRules:{defaultHearingTime:"18:00",decisionCommentDeadlineHour:12,agendaNotice:"Agenda usually posted the Thursday before the meeting",location:"Nampa City Hall, Council Chambers, 411 3rd St S, Nampa, ID",commentInstructions:"Once the agenda is posted, use the comment bubble in the meeting portal to send written comments, or the microphone button to sign up to speak. Include the relevant case number."},
    commentInstructionsUrl:"https://www.cityofnampa.us/1616/Public-Comment",sources:{cases:hearings,hearingsSchedule:"https://www.cityofnampa.us/1433/Upcoming-Public-Hearings",geometry:[hearings+"/0",hearings+"/1"],flum:cityData+"/30",agendas:"https://nampa.primegov.com/public/portal",addressPoints:"https://utility.arcgis.com/usrsvcs/servers/2cb0c34984644eb19ebeb3f8a17b7dc9/rest/services/Public/CityInformation_Public/MapServer/35",parcelFallback:"https://maps.canyonco.org/arcgisserver/rest/services/Assessor/CCPublicTaxparcels/MapServer/0"}},
  "canyon-county":{id:"canyon-county",slug:"canyon-county",country:"us",countryName:"United States",state:"id",stateName:"Idaho",stateAbbreviation:"ID",name:"Canyon County",type:"county",status:"coming soon",timezone:"America/Denver",center:[-116.7,43.63],boundary:canyonBoundary as MultiPolygon,boundaryLabel:"County boundary; tracking is not live",boundarySources:["https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1"],bodies:{planning:{id:"planning",label:"Planning & Zoning Commission",shortLabel:"P&Z",stageLabel:"P&Z hearing"},decision:{id:"board",label:"Board of County Commissioners",shortLabel:"Board",stageLabel:"Board hearing"}},meetingRules:{agendaNotice:"Check the published agenda for timing.",commentInstructions:"Comment instructions will be added when coverage launches."},sources:{}}
};
export const FEATURED_AREA_ID="nampa";
export function getArea(id:string){return Object.hasOwn(AREAS,id)?AREAS[id]:undefined;}
export function findArea(country:string,state:string,slug:string){return Object.values(AREAS).find(a=>a.country===country&&a.state===state&&a.slug===slug);}
export function areaPath(area:AreaDefinition|string){const a=typeof area==="string"?getArea(area):area;return a?`/${a.country}/${a.state}/${a.slug}`:"/"+area;}
export function canonicalAreaHref(id:string,path:string){const a=getArea(id);if(!a)return path;const old="/"+id;return path===old||path.startsWith(old+"/")||path.startsWith(old+"?")||path.startsWith(old+"#")?areaPath(a)+path.slice(old.length):path;}
export function stageLabel(stage:string,area:AreaDefinition){return stage.startsWith("P&Z hearing")?area.bodies.planning.stageLabel+stage.slice("P&Z hearing".length):stage.startsWith("Council hearing")?area.bodies.decision.stageLabel+stage.slice("Council hearing".length):stage;}
export function mapStageLabel(stage:string,area?:AreaDefinition){return stage==="P&Z"?area?.bodies.planning.shortLabel??"Planning":stage==="Council/Board"?area?.bodies.decision.shortLabel??"Decision body":stage;}
export function bodyLabel(body:string,area:AreaDefinition){return body===area.bodies.planning.id?area.bodies.planning.label:body===area.bodies.decision.id?area.bodies.decision.label:body;}
