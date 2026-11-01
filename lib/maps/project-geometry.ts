import {area,cleanCoords,feature,featureCollection,kinks,rewind,union,unkinkPolygon} from "@turf/turf";
import type {Feature,Polygon} from "geojson";
import type {CaseGeometry} from "./types";

/** Server-side collection/snapshot repair: repeated parcel rows must not become overlapping rings. */
export function normalizeProjectGeometry(geometry:CaseGeometry):CaseGeometry|null{
 const parts:Feature<Polygon>[]=[];
 for(const coordinates of geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates){
  try{
   const polygon=cleanCoords(feature({type:"Polygon",coordinates}));
   const repaired=kinks(polygon).features.length?unkinkPolygon(polygon).features:[polygon];
   parts.push(...repaired.filter(p=>area(p)>0));
  }catch{/* Degenerate source parts cannot establish a published boundary. */}
 }
 if(!parts.length)return null;
 const unique=[...new Map(parts.map(p=>[JSON.stringify(p.geometry.coordinates),p])).values()];
 const combined=unique.length===1?unique[0]:union(featureCollection(unique));
 return combined?rewind(combined.geometry,{reverse:false}) as CaseGeometry:null;
}
