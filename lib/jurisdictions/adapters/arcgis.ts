import type {FeatureCollection,Geometry} from "geojson";
import {SourceHttp} from "../http";
import type {JurisdictionDefinition} from "../types";
import type {Application,ApplicationAdapter,GisAdapter} from "./types";
import {caseNumbers,clean} from "./common";
import {geolocateApplications} from "../application-geolocation";
import {applicationRecordUrl} from "../application-source";
import {legacyAdapters,legacyFeed} from "./legacy";
export function arcgisAdapter(http:SourceHttp,attributeOnly=false):GisAdapter {
 return {metadata:async url=>http.json(url+"?f=json"),query:async(url,where="1=1")=>{
  const features:FeatureCollection<Geometry|null>["features"]=[],seen=new Set<string>();
  for(let offset=0;offset<100000;offset+=1000){
   const q=new URLSearchParams({where,outFields:"*",returnGeometry:String(!attributeOnly),outSR:"4326",f:attributeOnly?"json":"geojson",resultRecordCount:"1000",resultOffset:String(offset)});
   const result=await http.json<FeatureCollection<Geometry|null>&{error?:{message:string};exceededTransferLimit?:boolean;properties?:{exceededTransferLimit?:boolean}}>(url+"/query?"+q);
   if(attributeOnly&&Array.isArray(result.features)){result.type="FeatureCollection";result.features=result.features.map(f=>({type:"Feature",geometry:null,properties:(f as unknown as {attributes:Record<string,unknown>}).attributes??f.properties}));}
   if(result.error||result.type!=="FeatureCollection")throw Error("Invalid ArcGIS response: "+(result.error?.message??"missing features"));
   const fingerprint=JSON.stringify(result.features.map(f=>f.id??f.properties));if(seen.has(fingerprint))throw Error("ArcGIS pagination did not advance");seen.add(fingerprint);features.push(...result.features);
   if(!result.exceededTransferLimit&&!result.properties?.exceededTransferLimit)return {type:"FeatureCollection",features};
   if(!result.features.length)throw Error("ArcGIS pagination stalled");
  }throw Error("ArcGIS paging cap reached");
 }};
}
export function applicationFromFeature(config:JurisdictionDefinition,f:FeatureCollection<Geometry|null>["features"][number]):Application {
 const p=f.properties??{},fields=config.applications.params.fields as Record<string,string>??{},value=(k:string)=>clean(p[fields[k]??k]),recordId=value("id");
 const date=value("received");let received:string|undefined;if(date){const d=new Date(/^\d+$/.test(date)?Number(date):date);if(!Number.isNaN(d.getTime()))received=d.toISOString().slice(0,10);}
 return{recordId,relatedCaseNumbers:caseNumbers(config,value("related")),name:value("name")||recordId,type:value("type"),status:value("status"),address:value("address"),parcel:value("parcel").split(/[;,\s]+/).filter(Boolean),description:value("description"),received,geometry:f.geometry??undefined,recordUrl:applicationRecordUrl(config,recordId),sourceUrl:applicationRecordUrl(config,recordId),sourceFields:p};
}
export function applicationAdapter(config:JurisdictionDefinition,http:SourceHttp):ApplicationAdapter {
 if(config.legacyPublic)return legacyAdapters(config,()=>legacyFeed(config)).applications;
 const gis=arcgisAdapter(http,config.applications.params.attributeOnly===true),url=String(config.applications.params.url??""),where=String(config.applications.params.where??"1=1");
 return{listApplications:async since=>{if(config.applications.adapter==="none")return [];if(config.applications.adapter!=="arcgisFeatureLayer")throw Error("Accela logged-in scraping is not supported; configure a public inventory layer");const features=await gis.query(url,where);return geolocateApplications(config,features.features.map(f=>applicationFromFeature(config,f)).filter(a=>a.recordId&&(!since||!a.received||a.received>=since)),arcgisAdapter(http));},getApplication:async id=>{const field=(config.applications.params.fields as Record<string,string>)?.id;if(!field||!/^\w+$/.test(field))throw Error("Application ID field is not configured");const f=await gis.query(url,"("+where+") AND "+field+"='"+id.replace(/'/g,"''")+"'");return f.features[0]?(await geolocateApplications(config,[applicationFromFeature(config,f.features[0])],arcgisAdapter(http)))[0]:undefined;},healthcheck:async()=>{if(!url)return [];try{await gis.metadata(url);const count=await http.json<{count?:number}>(url+"/query?"+new URLSearchParams({f:"json",where,returnCountOnly:"true"}));if(http.checks.at(-1))http.checks.at(-1)!.records=count.count;}catch{}return http.checks;}};
}
