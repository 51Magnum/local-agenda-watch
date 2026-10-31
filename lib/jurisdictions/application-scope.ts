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
 return applications.filter(a=>hearingApplication(d,a)||[a.recordId,...a.relatedCaseNumbers].some(id=>linked.has(id))||organizationDevelopment(d,a)).map(a=>{
  const field=String(d.applications.params.applicantField??"");
  const protect=d.legacyPublic?residentialCase(d.id,a.recordId,a):!!(!hearingApplication(d,a)&&field&&individualApplicant(a.sourceFields[field])&&(residentialCase(d.id,a.recordId,a)||/accessory use|residential/i.test(a.type)));
  return {...a,...!d.legacyPublic?{privacyPolicy:"staff-individual" as const}:{},...protect?{residentialPrivacy:true}:!d.legacyPublic?{residentialPrivacy:false}:{}};
 });
}
export function organizationDevelopment(d:JurisdictionDefinition,a:Application){
 const applicant=a.sourceFields[String(d.applications.params.applicantField??"")];
 const organization=organizationApplicant(String(applicant??""))||/\bARCHITECTURE|ENGINEERING|SURVEYING\b/i.test(String(applicant??""));
 // A named individual may be the filing agent for an explicitly commercial project.
 const commercial=/commercial development|retail|\bwinery\b|wine production|tasting room/i.test(a.description);
 return (organization||commercial)&&/-(?:COM|MSP)(?:-|$)/i.test([a.recordId,...a.relatedCaseNumbers].join(" "))&&!/home.?occupation|single.?family|accessory use/i.test(a.description);
}
