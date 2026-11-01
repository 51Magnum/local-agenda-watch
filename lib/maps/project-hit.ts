import {area} from "@turf/turf";
import type {Geometry} from "geojson";
export type ProjectHit={properties?:Record<string,unknown>|null;geometry?:Geometry;layer:{id:string}};
/** Ignore unknown/tile-stale IDs; use full project area, never a clipped tile's area. */
export function resolveProjectHit<T>(hits:readonly ProjectHit[],lookup:(id:string)=>T|undefined,geometry:(item:T)=>Geometry|null|undefined,id:(hit:ProjectHit)=>unknown=hit=>hit.properties?.id){
 let selected:{hit:ProjectHit;item:T;id:string;area:number}|undefined;
 for(const hit of hits){const key=id(hit);if(key===null||key===undefined)continue;const stable=String(key),item=lookup(stable);if(!item)continue;
  const shape=geometry(item),size=shape&&(shape.type==="Polygon"||shape.type==="MultiPolygon")?area(shape):Infinity;
  if(!selected||size<selected.area)selected={hit,item,id:stable,area:size};
 }
 return selected;
}
