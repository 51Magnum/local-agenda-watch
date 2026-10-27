import {registryEntries} from "./generated";
import {validateJurisdictions} from "./validate";
export const JURISDICTION_REGISTRY=Object.fromEntries(validateJurisdictions(registryEntries).map(d=>[d.id,d]));
export const jurisdiction=(id:string)=>JURISDICTION_REGISTRY[id];
export const publicJurisdictions=()=>Object.values(JURISDICTION_REGISTRY).filter(d=>d.enabled&&d.launchStatus==="public").sort((a,b)=>(a.catalogOrder??a.mapOrder)-(b.catalogOrder??b.mapOrder));
export const ingestionJurisdictions=()=>Object.values(JURISDICTION_REGISTRY).filter(d=>d.enabled&&d.launchStatus!=="draft");
export const isPublicJurisdiction=(id:string)=>Boolean(jurisdiction(id)?.enabled&&jurisdiction(id)?.launchStatus==="public");
// TODO: a future discovery tool may draft these files; it must never publish them.
