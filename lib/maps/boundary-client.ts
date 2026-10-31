import type {BoundaryPayload} from "./boundary-types";
let pending:Promise<BoundaryPayload>|undefined;
/** Revalidate the ETag against current publication authority; only concurrent requests share a promise. */
export function loadAreaBoundaries(){
 return pending??=(async()=>{
  const response=await fetch("/api/map/boundaries",{cache:"no-cache"});
  if(!response.ok)throw Error("Coverage boundaries unavailable");
  return await response.json() as BoundaryPayload;
 })().catch(async()=>{
  const response=await fetch("/map-data/boundaries.json",{cache:"no-cache"});
  if(!response.ok)throw Error("Legacy coverage fallback unavailable");return await response.json() as BoundaryPayload;
 }).finally(()=>{pending=undefined;});
}
