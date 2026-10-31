import {area,feature,featureCollection,intersect,pointOnFeature,booleanPointInPolygon,circle,bbox} from "@turf/turf";
import {combinePolygons,polygonGeometry} from "../maps/gis";
import {geometryCentroid} from "../maps/spatial";
import type {CaseGeometry} from "../maps/types";
import type {Application,GisAdapter} from "./adapters/types";
import type {JurisdictionDefinition} from "./types";
type GeometryJoin={url:string;caseField:string;applicationFields:string[]};
type AddressFallback={url:string;fields:{number:string;direction:string;street:string;suffix?:string}};
const normalize=(v:unknown)=>String(v??"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
const quote=(s:string)=>"'"+s.replace(/'/g,"''")+"'";
const field=(s:string)=>{if(!/^\w+$/.test(s))throw Error("Invalid configured GIS field");return s;};
const suffixes:Record<string,string>={STREET:"ST",AVENUE:"AVE",ROAD:"RD",DRIVE:"DR",LANE:"LN",BOULEVARD:"BLVD",COURT:"CT",PLACE:"PL",CIRCLE:"CIR",PARKWAY:"PKWY",TERRACE:"TER"};
function addressParts(value:string){
 const text=normalize(value.split(",")[0]);if(/[&;/#]/.test(value))return;
 const m=text.match(/^(\d{1,6})\s+(?:(N|S|E|W|NE|NW|SE|SW|NORTH|SOUTH|EAST|WEST)\s+)?(.+?)\s+(STREET|ST|AVENUE|AVE|ROAD|RD|DRIVE|DR|LANE|LN|BOULEVARD|BLVD|WAY|COURT|CT|PLACE|PL|CIRCLE|CIR|PARKWAY|PKWY|TERRACE|TER)$/);
 if(!m)return;
 return {number:Number(m[1]),direction:({NORTH:"N",SOUTH:"S",EAST:"E",WEST:"W"} as Record<string,string>)[m[2]]??m[2]??"",street:m[3],suffix:suffixes[m[4]]??m[4]};
}
function publicQuery(url:string,where:string){return url+"/query?"+new URLSearchParams({where,outFields:"*",outSR:"4326",f:"pjson"});}
export async function geolocateApplications(d:JurisdictionDefinition,apps:Application[],gis:GisAdapter){
 const join=d.applications.params.geometryJoin as GeometryJoin|undefined,fallback=d.applications.params.addressPointFallback as AddressFallback|undefined;
 if(!join&&!fallback)return apps;
 const result=apps.map(a=>({...a}));
 if(join){
  const idsFor=(a:Application)=>[...new Set([a.recordId,...a.relatedCaseNumbers,...join.applicationFields.flatMap(k=>String(a.sourceFields[k]??"").toUpperCase().match(new RegExp(d.caseNumberPatterns.join("|"),"g"))??[])].map(normalize))];
  // Preserve punctuation in source case numbers; normalization is for lookup only.
  const ids=[...new Set(result.flatMap(a=>[a.recordId,...a.relatedCaseNumbers,...join.applicationFields.flatMap(k=>String(a.sourceFields[k]??"").toUpperCase().match(new RegExp(d.caseNumberPatterns.join("|"),"g"))??[])]))];
  const features=[];for(let i=0;i<ids.length;i+=50){const where=field(join.caseField)+" IN ("+ids.slice(i,i+50).map(quote).join(",")+")";try{features.push(...(await gis.query(join.url,where)).features);}catch{for(const app of result)app.geolocationDeferred=true;}}
  for(const app of result){if(app.geometry)continue;const ids=new Set(idsFor(app)),matching=features.filter(f=>ids.has(normalize(f.properties?.[join.caseField]))&&polygonGeometry(f.geometry));
   const geometry=combinePolygons(matching);if(geometry){app.geometry=geometry;app.locationVerification="verified";app.geometrySource="polygon";app.geometrySourceUrl=publicQuery(join.url,field(join.caseField)+" IN ("+matching.map(f=>quote(String(f.properties?.[join.caseField]))).join(",")+")");}
  }
 }
 if(fallback)for(const app of result){
  if(app.geometry)continue;const parts=addressParts(app.address);if(!parts)continue;
  const f=fallback.fields,where=field(f.number)+"="+parts.number+" AND UPPER("+field(f.street)+")="+quote(parts.street);
  let features;try{features=(await gis.query(fallback.url,where)).features;}catch{app.geolocationDeferred=true;continue;}
  const matching=features.filter(r=>r.geometry?.type==="Point"&&Number(r.properties?.[f.number])===parts.number&&normalize(r.properties?.[f.direction])===parts.direction&&normalize(r.properties?.[f.street])===parts.street&&(!f.suffix||(suffixes[normalize(r.properties?.[f.suffix])]??normalize(r.properties?.[f.suffix]))===parts.suffix));
  if(matching.length===1){app.geometry=matching[0].geometry!;app.locationVerification="approximate";app.geometrySource="address-point";app.geometrySourceUrl=publicQuery(fallback.url,where);}
 }
 return result.map(a=>({...a,locationVerification:a.locationVerification??(a.geometry?"verified":"unverified")}));
}
export function coverageEligible(app:Application,coverage:CaseGeometry){
 if(!app.geometry)return {...app,locationVerification:"unverified" as const};
 if(app.geometry.type==="Point")return booleanPointInPolygon(app.geometry,coverage)?app:undefined;
 if(!polygonGeometry(app.geometry))return {...app,geometry:undefined,locationVerification:"unverified" as const};
 const polygon=feature(app.geometry as CaseGeometry);
 if(booleanPointInPolygon(pointOnFeature(polygon),coverage))return app;
 const overlap=intersect(featureCollection([polygon,feature(coverage)])),ratio=overlap?area(overlap)/area(polygon):0;
 return ratio>.5?app:undefined;
}
/** Address points get an explicitly approximate marker, never a claimed parcel boundary. */
export function applicationMapLocation(app:Application){
 const point=app.geometry?.type==="Point"?app.geometry.coordinates.slice(0,2) as [number,number]:undefined;
 const geometry=point?circle(point,.025,{units:"kilometers",steps:24}).geometry:app.geometry&&polygonGeometry(app.geometry)?app.geometry as CaseGeometry:null;
 return {geometry,centroid:point??(geometry?geometryCentroid(geometry):null),bounds:geometry?bbox(geometry).slice(0,4) as [number,number,number,number]:undefined,confidence:point||!geometry?"approximate" as const:"exact" as const,source:point||!geometry?"none" as const:"polygon" as const,...point?{statusNote:"Approximate (address point)"}:!geometry?{statusNote:"Location unverified"}:{}};
}
