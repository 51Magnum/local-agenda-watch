import {unstable_cache} from "next/cache";
import type {MapCase} from "./types";
import {geometryCentroid} from "./spatial";
import {readableLocation} from "@/lib/resident-copy";
/** Intersections only: never request a resident's house number. Bounds keep this an approximate label. */
export const nearestIntersection=unstable_cache(async(lng:number,lat:number)=>{
 try{const q=new URLSearchParams({f:"json",location:lng+","+lat,featureTypes:"StreetInt",langCode:"en"});
 const r=await fetch("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?"+q,{signal:AbortSignal.timeout(1800)});if(!r.ok)return null;
 const data=await r.json(),a=data.address;if(a?.Addr_type!=="StreetInt")return null;
 return typeof a.Address==="string"&&a.Address.trim()?a.Address.trim():null;
 }catch{return null;}
},["project-intersection-v1"],{revalidate:30*86400});
export async function projectLocation(item:MapCase,areaName:string,official?:string){
 const known=readableLocation(official);if(known&&!/^0\s/.test(official??""))return known;
 const center=item.centroid??(item.geometry?geometryCentroid(item.geometry):null);if(!center)return known;
 const cross=await nearestIntersection(Number(center[0].toFixed(5)),Number(center[1].toFixed(5)));
 return cross?"Near "+cross+", "+areaName:known??"Mapped project area in "+areaName+" ("+center[1].toFixed(3)+", "+center[0].toFixed(3)+")";
}
