import type {Application} from "./adapters/types";
import type {JurisdictionDefinition} from "./types";
import {combinePolygons,polygonGeometry} from "../maps/gis";
type ProjectKey={fields:string[];pattern:string};
/** Group only when the source registry explicitly declares a shared project key. */
export function groupApplications(config:JurisdictionDefinition,applications:Application[]):Application[]{
 const key=config.applications.params.projectKey as ProjectKey|undefined,groups=new Map<string,Application[]>();
 for(const app of applications){
  const number=key?[...key.fields.map(f=>String(app.sourceFields[f]??"")),app.recordId].map(v=>v.match(new RegExp(key.pattern))?.[0]).find(Boolean):undefined;
  const id=number??app.recordId;
  groups.set(id,[...(groups.get(id)??[]),{...app,...number?{projectNumber:number}:{}}]);
 }
 return [...groups.values()].map(rows=>{
  const order=config.selfCheck?.typeOrder??["CPA","ZC","PUD","S","COM","CU","A","VAC","V","MSP","HD","FP","ALT","AC"];
  const rank=(a:Application)=>Math.min(...a.recordId.split("-").slice(1).map(s=>{const n=order.findIndex(code=>code.split("/").includes(s));return n<0?999:n;}),999);
  rows.sort((a,b)=>rank(a)-rank(b)||a.recordId.localeCompare(b.recordId));
  const first=rows[0],received=rows.flatMap(a=>a.received?[a.received]:[]).sort()[0];
  const polygons=rows.flatMap(a=>a.geometry&&polygonGeometry(a.geometry)?[{type:"Feature" as const,geometry:a.geometry,properties:{}}]:[]);
  return {...first,sourceRowCount:rows.reduce((n,a)=>n+(a.sourceRowCount??1),0),received,parcel:[...new Set(rows.flatMap(a=>a.parcel))].sort(),relatedCaseNumbers:[...new Set(rows.flatMap(a=>[a.recordId,...a.relatedCaseNumbers]))].filter(id=>id!==first.recordId).sort(),geometry:combinePolygons(polygons)??rows.find(a=>a.geometry)?.geometry};
 });
}
export function projectCaseMatches(app:Application,id:string){
 if(!app.projectNumber)return false;
 const prefix=app.projectNumber+"-";if(!id.startsWith(prefix))return false;
 // An appeal is a hearing about this project, even when no appeal row exists in GIS.
 if(id===prefix+"A")return true;
 const sourceSets=[app.recordId,...app.relatedCaseNumbers].filter(v=>v.startsWith(prefix)).map(v=>new Set(v.slice(prefix.length).split("-"))),suffixes=new Set(sourceSets.flatMap(s=>[...s])),agendaSuffixes=new Set(id.slice(prefix.length).split("-"));
 // Source rows can contain one component of a combined agenda case; never match by number alone.
 return suffixes.size>0&&agendaSuffixes.size>0&&(sourceSets.some(s=>[...s].every(part=>agendaSuffixes.has(part)))||[...agendaSuffixes].every(s=>suffixes.has(s)));
}
