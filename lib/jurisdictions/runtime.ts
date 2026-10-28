import {unstable_cache} from "next/cache";
import type {HearingFeed,Locality} from "../localities/types";
import type {JurisdictionConfig} from "../maps/types";
import {AREAS,areaPath} from "../areas/registry";
import {jurisdiction} from "./registry";
import {readStaging} from "./store";
import {stagedFeed,stagedMapSnapshot,configuredRecord} from "./resident-records";
export async function configuredFeed(id:string):Promise<HearingFeed>{const d=jurisdiction(id),snapshot=await readStaging(id);if(!d||!snapshot)throw Error("Jurisdiction snapshot unavailable");return stagedFeed(d,snapshot);}
export async function configuredSnapshot(id:string){const d=jurisdiction(id),snapshot=await readStaging(id);if(!d||!snapshot)throw Error("Jurisdiction snapshot unavailable");return stagedMapSnapshot(d,snapshot);}
export const publicConfiguredFeed=(id:string)=>unstable_cache(()=>configuredFeed(id),["configured-feed",id],{revalidate:3600,tags:["map-area:"+id]} )();
export function configuredLocality(id:string):Locality {const d=jurisdiction(id);return{slug:id,displayName:d.name,fullName:d.name+", Idaho",portalUrl:String(d.agenda[0].params.baseUrl),dataAttribution:"Official planning records and hearing documents",tracked:[],getHearings:()=>publicConfiguredFeed(id)};}
export function configuredMap(id:string):JurisdictionConfig{
 const d=jurisdiction(id),area=AREAS[id],fields=d.applications.params.fields as Record<string,string>??{};
 return{area,id,name:d.name,mapOnHub:true,center:d.area.center,zoom:10,bounds:[d.area.center[0]-.5,d.area.center[1]-.4,d.area.center[0]+.5,d.area.center[1]+.4],state:{abbreviation:d.state.toUpperCase(),fips:"16",name:d.area.stateName},caseGeometry:{layers:d.applications.adapter==="arcgisFeatureLayer"&&d.applications.params.attributeOnly!==true?[String(d.applications.params.url)]:[],where:String(d.applications.params.where??"1=1"),caseIdField:fields.id??"id",fields:{type:fields.type??"type",phase:fields.status??"status",status:fields.status??"status",title:fields.name??"name",parcel:fields.parcel},parcelFallback:{layerUrl:d.gis.parcels??"",matchField:"PARCEL",recordField:"PARCEL",ignored:[]}},flum:{layerUrl:d.gis.futureLandUse??"",categoryField:String(d.applications.params.flumField??"LandUse"),colorSource:"renderer",planName:d.name+" official future land use",label:d.name+" official future land use",adoptedDate:null,adoptionSource:d.gis.futureLandUse??d.boundary.url,simplifyTolerance:.00002},addressPoints:{layerUrl:"",addressField:"",where:"1=1",suffix:d.name+", ID"},stages:{phase:{},status:{},recorded:{phases:[],statuses:[]}},caseTypes:{},citywideTypes:[],recordForCase:configuredRecord,loadCases:()=>publicConfiguredFeed(id),presentation:h=>({title:h.displayTitle??h.appId,summary:h.description??h.appScope??"",href:areaPath(id)+"/plan/"+encodeURIComponent(h.appId)})};
}
