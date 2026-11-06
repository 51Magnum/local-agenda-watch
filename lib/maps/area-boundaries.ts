import "server-only";
import {createHash} from "node:crypto";
import {difference,feature,featureCollection} from "@turf/turf";
import {normalizeBoundaryGeometry} from "./boundary-geometry";
import {coverageColor} from "../areas/coverage-style";
import type {AreaDefinition} from "../areas/registry";
import type {BoundaryPayload} from "./boundary-types";
const masks=new Map<string,ReturnType<typeof difference>>();
export function boundaryVersion(areas:readonly AreaDefinition[]){
 const identity=areas.filter(a=>a.status==="live").toSorted((a,b)=>a.id.localeCompare(b.id)).map(a=>[a.id,a.name,a.type,a.country,a.state,a.slug,a.center,coverageColor(a),a.boundaryRevision,a.boundary,a.coverageBoundary]);
 return "coverage-v4-"+createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0,24);
}
export function buildAreaBoundaries(areas:readonly AreaDefinition[]):BoundaryPayload{
 const visible=areas.filter(a=>a.status==="live").toSorted((a,b)=>a.id.localeCompare(b.id));
 const covered=visible.map(a=>feature(normalizeBoundaryGeometry(a.coverageBoundary??a.boundary)));
 // City limits describe jurisdiction; planning-impact coverage belongs only in the mask.
 const shapes=visible.map((a,i)=>feature(a.type==="county"||!a.coverageBoundary?covered[i].geometry:normalizeBoundaryGeometry(a.boundary),{id:a.id,name:a.name,type:a.type,status:"live" as const,color:coverageColor(a),href:`/${a.country}/${a.state}/${a.slug}`}));
 const world=feature({type:"Polygon",coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]});
 const maskKey=createHash("sha256").update(JSON.stringify(covered.map(f=>f.geometry))).digest("hex");
 let mask=masks.get(maskKey);if(!masks.has(maskKey)){mask=shapes.length?difference(featureCollection([world,...covered])):world;if(mask)mask=feature(normalizeBoundaryGeometry(mask.geometry));masks.set(maskKey,mask);if(masks.size>4)masks.delete(masks.keys().next().value!); }
 return {version:boundaryVersion(visible),polygons:featureCollection(shapes),labels:featureCollection(visible.map(a=>feature({type:"Point",coordinates:a.center},{id:a.id,name:a.name,color:coverageColor(a)}))),uncovered:featureCollection(mask?[structuredClone(mask)]:[])};
}
