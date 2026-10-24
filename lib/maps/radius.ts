import {area,bbox,booleanIntersects,circle,difference,feature,featureCollection,intersect,union} from "@turf/turf";
import type {Feature,FeatureCollection} from "geojson";
import {AREAS,type AreaDefinition,canonicalAreaHref} from "@/lib/areas/registry";
import {nearbyCases,geometryCentroid} from "./spatial";
import type {CaseGeometry,FlumCache,MapCase,MapStage} from "./types";
export const COMMON_FLUM={"Residential low":"#fde68a","Residential med":"#fb923c","Residential high":"#ef4444",Commercial:"#ec4899",Industrial:"#a78bfa","Ag/Rural":"#bef264","Mixed use":"#38bdf8","Public/Open":"#34d399", "Residential (density unspecified)":"#fcd34d","Other / unspecified":"#a1a1aa"};
export type FlumGroup=keyof typeof COMMON_FLUM;
export function radiusBounds(coordinates:[number,number],miles:number){return bbox(circle(coordinates,miles,{units:"miles",steps:80})).slice(0,4) as [number,number,number,number];}
export function liveAreasInRadius(coordinates:[number,number],miles=1,areas=Object.values(AREAS)){
 const ring=circle(coordinates,miles,{units:"miles",steps:80});
 return areas.filter(a=>a.status==="live"&&booleanIntersects(ring,feature(a.boundary)));
}
export function jurisdictionLabel(area:AreaDefinition){return area.type==="city"?"City of "+area.name:area.name;}
export function stageBody(stage:MapStage,area:AreaDefinition){return stage==="P&Z"?area.bodies.planning.label:stage==="Council/Board"?area.bodies.decision.label:stage;}
export const commonStageLabel=(stage:string)=>stage==="P&Z"?"Hearing":stage;
function boxesOverlap(a:CaseGeometry,b:CaseGeometry){const x=bbox(a),y=bbox(b);return x[0]<=y[2]&&x[2]>=y[0]&&x[1]<=y[3]&&x[3]>=y[1];}
export function sameSite(a:MapCase,b:MapCase){
 if(a.parcelNamespace&&a.parcelNamespace===b.parcelNamespace&&a.parcelIds?.some(id=>b.parcelIds?.includes(id)))return true;
 if(!a.geometry||!b.geometry||!boxesOverlap(a.geometry,b.geometry))return false;
 try{const overlap=intersect(featureCollection([feature(a.geometry),feature(b.geometry)]));if(!overlap)return false;const shared=area(overlap);return shared/(area(a.geometry)+area(b.geometry)-shared)>.8;}catch{return false;}
}
/** Namespaced identifiers prevent identical case numbers in different cities colliding. */
export function combineRadiusCases(input:{area:AreaDefinition;cases:MapCase[]}[],coordinates:[number,number],miles:number){
 const groups:MapCase[]=[];
 for(const {area:a,cases}of [...input].sort((a,b)=>Number(a.area.type==="county")-Number(b.area.type==="county")))for(const c of nearbyCases(cases,coordinates,miles)){
  const body=c.stageBody??c.nextHearing?.body??stageBody(c.stage,a),member={areaId:a.id,caseId:c.id,title:c.title,href:canonicalAreaHref(a.id,c.href),stage:c.stage,body};
  const candidate={...c,id:a.id+":"+c.id,areaId:a.id,jurisdictionLabel:jurisdictionLabel(a),stageBody:body,caseIds:[c.id],members:[member],href:member.href};
  const existing=groups.find(g=>sameSite(g,candidate));
  if(!existing){groups.push(candidate);continue;}
  existing.members!.push(member);existing.caseIds=[...new Set([...existing.caseIds!,c.id])];
  if(existing.geometry&&c.geometry)try{existing.geometry=union(featureCollection([feature(existing.geometry),feature(c.geometry)]))?.geometry??existing.geometry;existing.centroid=geometryCentroid(existing.geometry);}catch{/* Preserve verified primary shape if the official rings cannot be merged. */}
  existing.visual??=c.visual;
  if(c.nextHearing&&(!existing.nextHearing||c.nextHearing.date<existing.nextHearing.date))existing.nextHearing=c.nextHearing;
 }
 return nearbyCases(groups,coordinates,miles);
}
/** Broad display groups describe land use, not zoning compatibility. Unknown density is never invented. */
export function flumGroup(value:string):FlumGroup{
 const s=value.toLowerCase();
 if(/mixed|^mu-|downtown|old town|lifestyle|village|community center/.test(s))return "Mixed use";
 if(/industrial/.test(s))return "Industrial";
 if(/commercial|office|employment|business park/.test(s))return "Commercial";
 if(/agricultur|rural/.test(s))return "Ag/Rural";
 if(/public|park|open|conserv|civic|education|airport|institution/.test(s))return "Public/Open";
 if(/med.high|high/.test(s))return "Residential high";
 if(/medium|^med/.test(s))return "Residential med";
 if(/low|estate|large lot/.test(s))return "Residential low";
 if(/residential|neighborhood|compact|foothills/.test(s))return "Residential (density unspecified)";
 return "Other / unspecified";
}
export function clipCombinedFlum(layers:{area:AreaDefinition;flum:FlumCache;categoryField:string}[],cities:AreaDefinition[],coordinates:[number,number],miles:number):FlumCache{
 const clip=feature({type:"Polygon",coordinates:[[[radiusBounds(coordinates,miles)[0],radiusBounds(coordinates,miles)[1]],[radiusBounds(coordinates,miles)[2],radiusBounds(coordinates,miles)[1]],[radiusBounds(coordinates,miles)[2],radiusBounds(coordinates,miles)[3]],[radiusBounds(coordinates,miles)[0],radiusBounds(coordinates,miles)[3]],[radiusBounds(coordinates,miles)[0],radiusBounds(coordinates,miles)[1]]]]});
 const features:Feature<CaseGeometry>[]=[];
 for(const layer of layers){
  let jurisdiction:Feature<CaseGeometry>|null=intersect(featureCollection([feature(layer.area.boundary),clip]));
  if(layer.area.type==="county"&&jurisdiction){
   // coverageBoundary excludes ALL incorporated cities, including cities not tracked yet.
   if(layer.area.coverageBoundary)jurisdiction=intersect(featureCollection([feature(layer.area.coverageBoundary),clip]));
   for(const city of cities){if(!jurisdiction)break;if(boxesOverlap(jurisdiction.geometry,city.boundary))jurisdiction=difference(featureCollection([jurisdiction,feature(city.boundary)]));}
  }
  if(!jurisdiction)continue;
  for(const f of layer.flum.geojson.features){
   if(!boxesOverlap(f.geometry,jurisdiction.geometry))continue;
   try{const shape=intersect(featureCollection([f,jurisdiction]));if(!shape)continue;
    const category=String(f.properties?.[layer.categoryField]??"Unknown"),label=layer.flum.legend.find(l=>l.value===category)?.label??category,group=flumGroup(label);
    features.push({...shape,properties:{category,group,jurisdiction:jurisdictionLabel(layer.area)}});
   }catch{/* A malformed polygon cannot establish a designation. */}
  }
 }
 const groups=new Set(features.map(f=>f.properties!.group));
 return {updatedAt:layers.map(l=>l.flum.updatedAt).sort()[0]??new Date().toISOString(),geojson:{type:"FeatureCollection",features} as FeatureCollection<CaseGeometry>,legend:Object.entries(COMMON_FLUM).filter(([g])=>groups.has(g)).map(([value,color])=>({value,label:value,color}))};
}
