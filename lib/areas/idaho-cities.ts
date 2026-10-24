import type {AreaDefinition} from "./registry";
import {MUNICIPAL_IDS,MUNICIPAL_SOURCES} from "@/lib/sources/municipal-config";
import kuna from "./boundaries/kuna.json";
import star from "./boundaries/star.json";
import middleton from "./boundaries/middleton.json";
import eagle from "./boundaries/eagle.json";
const boundaries={kuna,star,middleton,eagle};
export const IDAHO_CITIES:Record<string,AreaDefinition>=Object.fromEntries(MUNICIPAL_IDS.map(id=>{const s=MUNICIPAL_SOURCES[id];return [id,{
 id,slug:id,country:"us",countryName:"United States",state:"id",stateName:"Idaho",stateAbbreviation:"ID",name:s.name,type:"city",status:"live",timezone:"America/Denver",center:[...s.center],boundary:boundaries[id] as AreaDefinition["boundary"],boundaryLabel:"Official city limits",boundarySources:[...(id==="kuna"?["https://services1.arcgis.com/WHM6qC35aMtyAAlN/ArcGIS/rest/services/CityLimitsAndImpactAreas/FeatureServer/1"]:[s.boundary]),...(id==="star"?[MUNICIPAL_SOURCES.middleton.boundary]:[])],
 coverageNote:s.cases?"City planning tracker and published hearings. A past hearing alone does not establish a final decision.":"Initial coverage from published land-use hearings. Projects without a verified site boundary appear in All cases; this is not a complete application inventory.",
 bodies:{planning:{id:"P&Z",label:"Planning & Zoning Commission",shortLabel:"P&Z",stageLabel:"P&Z hearing"},decision:{id:"City Council",label:"City Council",shortLabel:"Council",stageLabel:"Council hearing"},...(id==="eagle"?{additional:[{id:"Design Review Board",label:"Design Review Board",shortLabel:"Design review",stageLabel:"Design review"}]}:{})},
 meetingRules:{agendaNotice:"Agenda not posted yet; check the official meeting calendar",location:s.location,commentInstructions:"Use the city's published hearing notice for written comments and speaking instructions. Include the application number. Confirm deadlines with the published agenda."},commentInstructionsUrl:s.comments,
 sources:{cases:s.cases||s.tracker,hearingsSchedule:s.agendas,geometry:s.cases?[s.cases]:[],flum:s.flum||undefined,agendas:s.agendas}
 } satisfies AreaDefinition];}));
