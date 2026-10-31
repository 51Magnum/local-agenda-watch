import "server-only";
import {registryEntries,siteReviewAreaIds} from "./generated";
import {validateJurisdictions} from "./validate";
import {isPreview} from "../runtime-environment";
export const JURISDICTION_REGISTRY=Object.fromEntries(validateJurisdictions(registryEntries).map(d=>[d.id,d]));
export const jurisdiction=(id:string)=>JURISDICTION_REGISTRY[id];
export const isSiteReviewArea=(id:string)=>siteReviewAreaIds.includes(id);
export const publicJurisdictions=()=>Object.values(JURISDICTION_REGISTRY).filter(d=>isPreview()?isSiteReviewArea(d.id):d.enabled&&d.launchStatus==="public").sort((a,b)=>(a.catalogOrder??a.mapOrder)-(b.catalogOrder??b.mapOrder));
export const ingestionJurisdictions=()=>Object.values(JURISDICTION_REGISTRY).filter(d=>d.enabled&&d.launchStatus!=="draft");
export const isPublicJurisdiction=(id:string)=>isPreview()?isSiteReviewArea(id):Boolean(jurisdiction(id)?.enabled&&jurisdiction(id)?.launchStatus==="public");
/** Server routing candidates are metadata only; publication is checked in the database per request. */
export const routeJurisdictions=()=>Object.values(JURISDICTION_REGISTRY).filter(d=>isPreview()?isSiteReviewArea(d.id):d.enabled&&(d.legacyPublic||d.launchStatus!=="draft"));
export async function jurisdictionVisible(id:string){
 if(isPreview())return isSiteReviewArea(id);
 const d=jurisdiction(id);if(!d?.enabled)return false;if(d.legacyPublic)return true;
 try{return !!await(await import("./self-check-store")).readPublished(id);}catch{return false;}
}
// TODO: a future discovery tool may draft these files; it must never publish them.
