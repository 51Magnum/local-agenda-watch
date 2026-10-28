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
  rows.sort((a,b)=>a.recordId.localeCompare(b.recordId));
  const first=rows[0],received=rows.flatMap(a=>a.received?[a.received]:[]).sort()[0];
  const polygons=rows.flatMap(a=>a.geometry&&polygonGeometry(a.geometry)?[{type:"Feature" as const,geometry:a.geometry,properties:{}}]:[]);
  return {...first,received,parcel:[...new Set(rows.flatMap(a=>a.parcel))].sort(),relatedCaseNumbers:[...new Set(rows.flatMap(a=>[a.recordId,...a.relatedCaseNumbers]))].filter(id=>id!==first.recordId).sort(),geometry:combinePolygons(polygons)??rows.find(a=>a.geometry)?.geometry};
 });
}
export function projectCaseMatches(app:Application,id:string){
 if(!app.projectNumber)return false;
 const prefix=app.projectNumber+"-";if(!id.startsWith(prefix))return false;
 const suffixes=new Set([app.recordId,...app.relatedCaseNumbers].filter(v=>v.startsWith(prefix)).flatMap(v=>v.slice(prefix.length).split("-"))),agendaSuffixes=new Set(id.slice(prefix.length).split("-"));
 // Source rows can contain one component of a combined agenda case; never match by number alone.
 return suffixes.size>0&&agendaSuffixes.size>0&&([...suffixes].every(s=>agendaSuffixes.has(s))||[...agendaSuffixes].every(s=>suffixes.has(s)));
}
