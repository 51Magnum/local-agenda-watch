import "server-only";
import {createHash} from "node:crypto";
import {difference,feature,featureCollection,simplify,truncate} from "@turf/turf";
import {coverageColor} from "../areas/coverage-style";
import type {AreaDefinition} from "../areas/registry";
import type {BoundaryPayload} from "./boundary-types";
export function boundaryVersion(areas:readonly AreaDefinition[]){
 const identity=areas.filter(a=>a.status==="live").toSorted((a,b)=>a.id.localeCompare(b.id)).map(a=>[a.id,a.name,a.type,a.country,a.state,a.slug,a.center,coverageColor(a),a.boundaryRevision,a.coverageBoundary??a.boundary]);
 return "coverage-v2-"+createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0,24);
}
export function buildAreaBoundaries(areas:readonly AreaDefinition[]):BoundaryPayload{
 const visible=areas.filter(a=>a.status==="live").toSorted((a,b)=>a.id.localeCompare(b.id));
 const shapes=visible.map(a=>({...truncate(simplify(feature(a.coverageBoundary??a.boundary),{tolerance:.0006}),{precision:5}),properties:{id:a.id,name:a.name,type:a.type,status:"live" as const,color:coverageColor(a),href:`/${a.country}/${a.state}/${a.slug}`}}));
 const world=feature({type:"Polygon",coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]});
 const mask=shapes.length?difference(featureCollection([world,...shapes])):world;
 return {version:boundaryVersion(visible),polygons:featureCollection(shapes),labels:featureCollection(visible.map(a=>feature({type:"Point",coordinates:a.center},{id:a.id,name:a.name}))),uncovered:featureCollection(mask?[truncate(mask,{precision:5})]:[])};
}
