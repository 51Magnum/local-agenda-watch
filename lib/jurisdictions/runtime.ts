import {officialGisLink} from "./official-gis-link";

import type {HearingFeed,Locality} from "../localities/types";
import type {JurisdictionConfig} from "../maps/types";
import {getArea,areaPath} from "../areas/registry";
import {jurisdiction} from "./registry";

import {readPublished} from "./self-check-store";
import {isPreview} from "../runtime-environment";
import {readReviewSnapshot} from "./review-snapshot";
import {stagedFeed,stagedMapSnapshot,configuredRecord} from "./resident-records";
export async function configuredFeed(id:string):Promise<HearingFeed>{if(isPreview())return readReviewSnapshot(id)?.feed??{active:[],completed:[],scheduleUnavailable:true,dataUnavailable:true};const d=jurisdiction(id),snapshot=await readPublished(id);if(!d)throw Error("Jurisdiction unavailable");if(!snapshot)return{active:[],completed:[],scheduleUnavailable:true,dataUnavailable:true};return stagedFeed(d,snapshot);}
export async function configuredSnapshot(id:string):Promise<import("../maps/types").MapSnapshot>{if(isPreview()){const review=readReviewSnapshot(id);if(!review)throw Error("No committed review snapshot");return review.map;}const d=jurisdiction(id),snapshot=await readPublished(id);if(!d)throw Error("Jurisdiction unavailable");if(!snapshot)return{version:1,jurisdiction:id,updatedAt:new Date().toISOString(),cases:[],warnings:["Official records are being collected; check the county source for the full record."]};return stagedMapSnapshot(d,snapshot);}
export const publicConfiguredFeed=(id:string)=>configuredFeed(id);
export function configuredLocality(id:string):Locality {const d=jurisdiction(id);return{slug:id,displayName:d.name,fullName:d.name+", Idaho",portalUrl:String(d.agenda[0].params.baseUrl),dataAttribution:"Official planning records and hearing documents",tracked:[],getHearings:()=>publicConfiguredFeed(id)};}
export function configuredMap(id:string):JurisdictionConfig{
 const d=jurisdiction(id),area=getArea(id)!,fields=d.applications.params.fields as Record<string,string>??{};
 return{area,id,name:d.name,mapOnHub:true,center:d.area.center,zoom:10,bounds:[d.area.center[0]-.5,d.area.center[1]-.4,d.area.center[0]+.5,d.area.center[1]+.4],state:{abbreviation:d.state.toUpperCase(),fips:"16",name:d.area.stateName},caseGeometry:{layers:d.applications.adapter==="arcgisFeatureLayer"&&d.applications.params.attributeOnly!==true?[String(d.applications.params.url)]:[],where:String(d.applications.params.where??"1=1"),caseIdField:fields.id??"id",fields:{type:fields.type??"type",phase:fields.status??"status",status:fields.status??"status",title:fields.name??"name",parcel:fields.parcel},parcelFallback:{layerUrl:d.gis.parcels??"",matchField:"PARCEL",recordField:"PARCEL",ignored:[]}},flum:{layerUrl:d.gis.futureLandUse??"",categoryField:String(d.applications.params.flumField??"LandUse"),colorSource:"renderer",planName:d.name+" official future land use",label:d.name+" official future land use",adoptedDate:null,adoptionSource:officialGisLink(d.gis.futureLandUse??d.boundary.url)!,simplifyTolerance:.00002},addressPoints:{layerUrl:"",addressField:"",where:"1=1",suffix:d.name+", ID"},stages:{phase:{},status:{},recorded:{phases:[],statuses:[]}},caseTypes:{},citywideTypes:[],recordForCase:configuredRecord,loadCases:()=>publicConfiguredFeed(id),presentation:h=>({title:h.displayTitle??h.appId,summary:h.description??h.appScope??"",href:areaPath(id)+"/plan/"+encodeURIComponent(h.appId)})};
}
