import "server-only";
import {createHash} from "node:crypto";
import {feature,featureCollection,truncate,union} from "@turf/turf";
import type {CaseGeometry} from "./types";
const prepared=new Map<string,CaseGeometry>();
/** Preserve street-level edges and holes; dissolve overlaps without Douglas-Peucker simplification. */
export function normalizeBoundaryGeometry(geometry:CaseGeometry,precision:number|null=6):CaseGeometry{
 const key=createHash("sha256").update(JSON.stringify([precision,geometry])).digest("hex"),cached=prepared.get(key);
 if(cached)return structuredClone(cached);
 const rounded=precision===null?feature(geometry):truncate(feature(geometry),{precision,coordinates:2});
 const result=union(featureCollection([rounded,rounded]));
 if(!result)throw Error("Official boundary has no polygonal coverage");
 prepared.set(key,structuredClone(result.geometry));if(prepared.size>48)prepared.delete(prepared.keys().next().value!);
 return result.geometry;
}
