import type {BoundaryPayload} from "./boundary-types";
let pending:Promise<BoundaryPayload>|undefined,cached:BoundaryPayload|undefined,etag:string|undefined;
/** Revalidate publication on every request, reusing parsed geometry on a genuine 304. */
export function loadAreaBoundaries(){
 return pending??=(async()=>{
  const response=await fetch("/api/map/boundaries",{cache:"no-store",headers:etag?{"If-None-Match":etag}:{}});
  if(response.status===304&&cached)return cached;
  if(!response.ok)throw Error("Coverage boundaries unavailable");
  cached=await response.json() as BoundaryPayload;etag=response.headers.get("etag")??undefined;
  return cached;
 })().catch(async()=>{
  // Never retain unpublished/stale snapshot geometry through a source failure.
  cached=undefined;etag=undefined;
  const response=await fetch("/map-data/boundaries.json",{cache:"no-cache"});
  if(!response.ok)throw Error("Legacy coverage fallback unavailable");return await response.json() as BoundaryPayload;
 }).finally(()=>{pending=undefined;});
}
