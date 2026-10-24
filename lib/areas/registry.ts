import type { MultiPolygon, Polygon } from "geojson";
import nampaBoundary from "./boundaries/nampa.json";
import canyonBoundary from "./boundaries/canyon-county.json";
import meridianBoundary from "./boundaries/meridian.json";
import canyonJurisdiction from "./boundaries/canyon-county-jurisdiction.json";
export type AreaDefinition = {
  id:string; slug:string; country:string; countryName:string; state:string; stateName:string; stateAbbreviation:string;
  name:string; type:"city"|"county"; status:"live"|"coming soon"; timezone:string;
  center:[number,number]; boundary:Polygon|MultiPolygon; boundaryLabel:string; boundarySources:string[]; coverageBoundary?:Polygon|MultiPolygon; coverageNote?:string;
  bodies:{additional?:{id:string;label:string;shortLabel:string;stageLabel:string}[];planning:{id:string;label:string;shortLabel:string;stageLabel:string};decision:{id:string;label:string;shortLabel:string;stageLabel:string}};
  meetingRules:{defaultHearingTime?:string;decisionCommentDeadlineHour?:number;agendaNotice:string;commentInstructions:string;location?:string};
  commentInstructionsUrl?:string;
  addressSearch?:{addressField:string;where:string;suffix:string};
  flumCompatibility?:{
    zoningCodePattern:string;
    categories:Record<string,{districts:string[];sourceUrl:string}>;
  };
  sources:{cases?:string;hearingsSchedule?:string;geometry?:string[];flum?:string;agendas?:string;addressPoints?:string;parcelFallback?:string};
};
const cityData="https://utility.arcgis.com/usrsvcs/servers/3543690ae3bf41a1a77b9b9b2bc477ca/rest/services/Public/NampaOpenData/MapServer";
const hearings="https://utility.arcgis.com/usrsvcs/servers/757f490738bd43da906508745cf92337/rest/services/Public/PZ_Hearings/MapServer";
export const AREAS:Record<string,AreaDefinition>={
  nampa:{id:"nampa",slug:"nampa",country:"us",countryName:"United States",state:"id",stateName:"Idaho",stateAbbreviation:"ID",name:"Nampa",type:"city",status:"live",timezone:"America/Denver",center:[-116.5635,43.5739],boundary:nampaBoundary as MultiPolygon,boundaryLabel:"City limits and official area of impact",boundarySources:[cityData+"/6",cityData+"/12"],
    addressSearch:{addressField:"SiteAddres",where:"UPPER(SiteCity) = 'NAMPA' AND SiteState = 'ID'",suffix:"Nampa, ID"},
    flumCompatibility:{
      zoningCodePattern:"\\b(?:RS\\s*\\d+(?:\\.\\d+)?|RML|RMH|RD|RA|RP|BN|BC|GB[12]?|IP|IL|IH|HC|U)\\b",
      categories:{
        "Medium Density Residential":{districts:["RS4","RS6","RS7","RS8.5"],sourceUrl:"https://www.cityofnampa.us/DocumentCenter/View/13801/3-Medium-Density-Residential"},
        "Industrial":{districts:["IL","IP","IH"],sourceUrl:"https://www.cityofnampa.us/DocumentCenter/View/13805/7-Industrial"},
      },
    },
    bodies:{planning:{id:"P&Z",label:"Planning & Zoning Commission",shortLabel:"P&Z",stageLabel:"P&Z hearing"},decision:{id:"City Council",label:"City Council",shortLabel:"Council",stageLabel:"Council hearing"}},
    meetingRules:{defaultHearingTime:"18:00",decisionCommentDeadlineHour:12,agendaNotice:"Agenda usually posted the Thursday before the meeting",location:"Nampa City Hall, Council Chambers, 411 3rd St S, Nampa, ID",commentInstructions:"Once the agenda is posted, use the comment bubble in the meeting portal to send written comments, or the microphone button to sign up to speak. Include the relevant case number."},
    commentInstructionsUrl:"https://www.cityofnampa.us/1616/Public-Comment",sources:{cases:hearings,hearingsSchedule:"https://www.cityofnampa.us/1433/Upcoming-Public-Hearings",geometry:[hearings+"/0",hearings+"/1"],flum:cityData+"/30",agendas:"https://nampa.primegov.com/public/portal",addressPoints:"https://utility.arcgis.com/usrsvcs/servers/2cb0c34984644eb19ebeb3f8a17b7dc9/rest/services/Public/CityInformation_Public/MapServer/35",parcelFallback:"https://maps.canyonco.org/arcgisserver/rest/services/Assessor/CCPublicTaxparcels/MapServer/0"}},
  meridian:{id:"meridian",slug:"meridian",country:"us",countryName:"United States",state:"id",stateName:"Idaho",stateAbbreviation:"ID",name:"Meridian",type:"city",status:"live",timezone:"America/Denver",center:[-116.3915,43.6121],boundary:meridianBoundary as Polygon|MultiPolygon,boundaryLabel:"Official city limits",boundarySources:["https://gis.meridiancity.org/server/rest/services/CD/Boundaries_places_Webservice/MapServer/2"],coverageNote:"City planning applications. Nearby unincorporated areas may have a different planning authority.",
    bodies:{planning:{id:"P&Z",label:"Planning & Zoning Commission",shortLabel:"P&Z",stageLabel:"P&Z hearing"},decision:{id:"City Council",label:"City Council",shortLabel:"Council",stageLabel:"Council hearing"}},
    meetingRules:{agendaNotice:"Check the official agenda archive for the meeting agenda and packet.",location:"City Council Chambers, 33 East Broadway Avenue, Meridian, Idaho",commentInstructions:"Follow the City's public-meeting instructions to submit written testimony or sign up to speak. Confirm the deadline for your hearing; the noon exhibit deadline is separate from written testimony."},commentInstructionsUrl:"https://meridiancity.org/government/public-meeting-information/",
    sources:{cases:"https://gis.meridiancity.org/server/rest/services/CD/Development_Feature_Layer/FeatureServer/6",geometry:["https://gis.meridiancity.org/server/rest/services/CD/Development_Feature_Layer/FeatureServer/6"],flum:"https://gis.meridiancity.org/server/rest/services/CD/FLUM_Webservice/MapServer/15",hearingsSchedule:"https://apps.meridiancity.org/CLERKSCONTENT/pubhearnot_detail.aspx",agendas:"https://apps.meridiancity.org/CLERKSCONTENT/meridian_agenda_minutes.aspx",parcelFallback:"https://gis.meridiancity.org/server/rest/services/CD/Parcel_Layers/MapServer/0"}},
  "canyon-county":{id:"canyon-county",slug:"canyon-county",country:"us",countryName:"United States",state:"id",stateName:"Idaho",stateAbbreviation:"ID",name:"Canyon County",type:"county",status:"live",timezone:"America/Denver",center:[-116.7,43.63],boundary:canyonBoundary as MultiPolygon,coverageBoundary:canyonJurisdiction as MultiPolygon,boundaryLabel:"Unincorporated Canyon County",coverageNote:"County land-use cases. Incorporated cities have separate planning authorities; a postal city does not determine jurisdiction.",boundarySources:["https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1","https://maps.canyonco.org/arcgisserver/rest/services/General/CITY_LIMITS_PUBLIC/FeatureServer/0"],
    bodies:{planning:{id:"P&Z",label:"Planning & Zoning Commission",shortLabel:"Planning / Examiner",stageLabel:"P&Z hearing"},decision:{id:"Board of County Commissioners",label:"Board of County Commissioners",shortLabel:"Board",stageLabel:"Board hearing"},additional:[{id:"Hearing Examiner",label:"Hearing Examiner",shortLabel:"Examiner",stageLabel:"Hearing Examiner"}]},
    meetingRules:{agendaNotice:"Staff reports are published seven days before the scheduled hearing.",commentInstructions:"Use the case-specific comment deadline and contact shown in the County's hearing record. Confirm how to submit comments and the hearing location in the published notice."},commentInstructionsUrl:"https://landhearingsagenda.canyoncounty.id.gov/Landing",
    sources:{cases:"https://maps.canyonco.org/arcgisserver/rest/services/DSD/DSD_PLANNING_ZONING_APP_TRACKER/FeatureServer/0",hearingsSchedule:"https://landhearingsagenda.canyoncounty.id.gov/Landing",geometry:["https://maps.canyonco.org/arcgisserver/rest/services/DSD/DSD_PLANNING_ZONING_APP_TRACKER/FeatureServer/0"],flum:"https://maps.canyonco.org/arcgisserver/rest/services/DSD/Future_Land_Use_2030_Adopted/MapServer/1",agendas:"https://landhearingsagenda.canyoncounty.id.gov/Landing",parcelFallback:"https://maps.canyonco.org/arcgisserver/rest/services/Assessor/CCPublicTaxparcels/MapServer/0"}}

};
export const FEATURED_AREA_ID="nampa";
export function getArea(id:string){return Object.hasOwn(AREAS,id)?AREAS[id]:undefined;}
export function findArea(country:string,state:string,slug:string){return Object.values(AREAS).find(a=>a.country===country&&a.state===state&&a.slug===slug);}
export function areaPath(area:AreaDefinition|string){const a=typeof area==="string"?getArea(area):area;return a?`/${a.country}/${a.state}/${a.slug}`:"/"+area;}
export function canonicalAreaHref(id:string,path:string){const a=getArea(id);if(!a)return path;const old="/"+id;return path===old||path.startsWith(old+"/")||path.startsWith(old+"?")||path.startsWith(old+"#")?areaPath(a)+path.slice(old.length):path;}
export function stageLabel(stage:string,area:AreaDefinition){return stage.startsWith("P&Z hearing")?area.bodies.planning.stageLabel+stage.slice("P&Z hearing".length):stage.startsWith("Council hearing")?area.bodies.decision.stageLabel+stage.slice("Council hearing".length):stage;}
export function mapStageLabel(stage:string,area?:AreaDefinition){return stage==="P&Z"?area?.bodies.planning.shortLabel??"Planning":stage==="Council/Board"?area?.bodies.decision.shortLabel??"Decision body":stage;}
export function bodyLabel(body:string,area:AreaDefinition){return body===area.bodies.planning.id?area.bodies.planning.label:body===area.bodies.decision.id?area.bodies.decision.label:body;}
