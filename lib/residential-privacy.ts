import {circle,bbox} from "@turf/turf";
import type {MapCase} from "./maps/types";
export const PRIVACY_TAG="residential-privacy-v1";
export type PrivacyOverrides=Record<string,{mode:"protect"|"public";reason:string}>;
/** Protected residential cases use the activity, never the applicant's identity. */
export function residentialPublicTitle(value: unknown) {
 const text=JSON.stringify(value??{});
 return /day[ -]*care|child[ -]*care/i.test(text) ? "Home daycare permit" : /home[ -]*occupation/i.test(text) ? "Home business permit" : /variance/i.test(text) ? "Residential variance request" : "Residential permit request";
}
const known=new Set(["nampa/CUP-00412-2026","nampa/CUP-00413-2026"]);
export function residentialCase(area:string,id:string,value:unknown,overrides:PrivacyOverrides={}) {
 const override=overrides[area+"/"+id];if(override)return override.mode==="protect";
 if(known.has(area+"/"+id)||(value&&typeof value==="object"&&"residentialPrivacy" in value&&value.residentialPrivacy===true))return true;
 const text=JSON.stringify(value);
 return /home[ -]*(?:occupation|day[ -]*care)|in[ -]*home\s+(?:daycare|childcare)|single[ -]*family\s+(?:home|residence|dwelling)|existing\s+(?:home|residence)/i.test(text) && /home[ -]*(?:occupation|day[ -]*care)|in[ -]*home|variance|conditional use|\bpermit\b/i.test(text);
}
export function blockAddress(value:string){
 return value.replace(/\b(\d{1,6})\s+(?!block\s+of\b)((?:[A-Za-z][\w.'’-]*\s+){0,7}(?:St(?:reet)?|Ave(?:nue)?|Rd|Road|Dr(?:ive)?|Ln|Lane|Blvd|Boulevard|Way|Ct|Court|Pl|Place|Cir(?:cle)?|Pkwy|Parkway|Ter(?:race)?))\b/gi,(_all,n,street)=>`${Math.floor(Number(n)/100)*100} block of ${street}`);
}
/** Redact public prose recursively; preserve functioning official-source URLs. */
export function redactResidence<T>(value:T):T{
 if(typeof value==="string")return (value.startsWith("http")||value.startsWith("/")?value:blockAddress(value)) as T;
 if(Array.isArray(value))return value.map(redactResidence) as T;
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redactResidence(v)])) as T;
 return value;
}
export function protectMapCase(area:string,item:MapCase,overrides:PrivacyOverrides={}):MapCase{
 const protectedCase=residentialCase(area,item.id.split(":").at(-1)!,item,overrides)||item.members?.some(m=>residentialCase(m.areaId,m.caseId,m,overrides));
 if(!protectedCase)return item;
 const safe=redactResidence(item),center=item.centroid;
 const centroid=center?[Math.round(center[0]*200)/200,Math.round(center[1]*200)/200] as [number,number]:null;
 const geometry=centroid?circle(centroid,.3,{units:"miles",steps:32}).geometry:null;
 const title=residentialPublicTitle(item);
 const explanation="A request for permission for a residential use. Check the official record for the proposed activity and any conditions.";
 return {...safe,title,summary:explanation,popup:safe.popup?{...safe.popup,headline:title,projectName:title,explanation,aiGenerated:false}:undefined,members:safe.members?.map(m=>({...m,title})),residentialPrivacy:true,visual:undefined,geometry,centroid,bounds:geometry?bbox(geometry).slice(0,4) as [number,number,number,number]:undefined,parcelIds:undefined,sourceUrl:undefined,source:"none",confidence:"approximate"};
}
export function privateResidentialDocument(label:string){return /affidavit|application|sign[ -]*in|attendance|mailing|neighbou?rhood meeting|\bletter\b|\bnotice\b|form\b/i.test(label.replace(/_/g," "));}
