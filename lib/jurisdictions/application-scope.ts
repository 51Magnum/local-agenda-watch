import {organizationApplicant} from "../applicant-privacy";
import {residentialCase} from "../residential-privacy";
import type {Application,Meeting} from "./adapters/types";
import type {JurisdictionDefinition} from "./types";
/** Conservative name classifier: organizations are excluded before person patterns. */
export function individualApplicant(value:unknown):boolean{
 const text=String(value??"").trim().replace(/\s+(?:&|AND)\s+/gi," ");
 if(!text||organizationApplicant(text))return false;
 const word="[\\p{L}][\\p{L}.'’\\-]*";
 return new RegExp(`^${word}(?: ${word})?,\\s*${word}(?: ${word}){0,2}$`,"u").test(text)||new RegExp(`^${word}(?: ${word}){1,3}$`,"u").test(text);
}
export function hearingApplication(d:JurisdictionDefinition,a:Application){
 const suffixes=d.applications.params.hearingSuffixes as string[]|undefined;
 return !suffixes||[a.recordId,...a.relatedCaseNumbers].some(id=>id.split("-").slice(1).some(s=>suffixes.includes(s)));
}
export function applicationScope(d:JurisdictionDefinition,applications:Application[],meetings:Meeting[]):Application[]{
 const linked=new Set(meetings.flatMap(m=>m.items.flatMap(i=>[...i.caseNumbers,...i.matchedApplications?.map(a=>a.recordId)??[]])));
 return applications.filter(a=>hearingApplication(d,a)||[a.recordId,...a.relatedCaseNumbers].some(id=>linked.has(id))).map(a=>{
  const field=String(d.applications.params.applicantField??"");
  const protect=residentialCase(d.id,a.recordId,a)||(!hearingApplication(d,a)&&field&&individualApplicant(a.sourceFields[field]));
  return {...a,...protect?{residentialPrivacy:true}:{}};
 });
}
