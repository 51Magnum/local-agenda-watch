import {area,bbox,booleanIntersects,circle,difference,feature,featureCollection,intersect,union,simplify} from "@turf/turf";
import type {Feature,FeatureCollection} from "geojson";
import {AREAS,type AreaDefinition,canonicalAreaHref} from "@/lib/areas/registry";
import {nearbyCases,geometryCentroid} from "./spatial";
import type {CaseGeometry,FlumCache,MapCase,MapStage} from "./types";
export const COMMON_FLUM={"Residential low":"#fde68a","Residential med":"#fb923c","Residential high":"#ef4444",Commercial:"#ec4899",Industrial:"#a78bfa","Ag/Rural":"#bef264","Mixed use":"#38bdf8","Public/Open":"#34d399", "Residential (density unspecified)":"#fcd34d","Other / unspecified":"#a1a1aa"};
export type FlumGroup=keyof typeof COMMON_FLUM;
export function radiusBounds(coordinates:[number,number],miles:number){return bbox(circle(coordinates,miles,{units:"miles",steps:80})).slice(0,4) as [number,number,number,number];}
export function boundsPolygon(bounds:readonly number[]):Feature<CaseGeometry>{const [w,s,e,n]=bounds;return feature({type:"Polygon",coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]});}
export function liveAreasInBounds(bounds:readonly number[],areas=Object.values(AREAS)){const view=boundsPolygon(bounds);return areas.filter(a=>a.status==="live"&&booleanIntersects(view,feature(a.boundary)));}
export function parseMapBounds(value:string|null):[number,number,number,number]|undefined{
 if(!value)return;const b=value.split(",").map(Number);
 if(b.length!==4||b.some(v=>!Number.isFinite(v))||b[0]<-180||b[2]>180||b[1]<-90||b[3]>90||b[0]>=b[2]||b[1]>=b[3])return;
 return b as [number,number,number,number];
}
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
/** Pick one case consistently for title, color, link, next step and stage. */
export function compareSiteLead(a:MapCase,b:MapCase,now=new Date()){
 const today=(c:MapCase)=>new Intl.DateTimeFormat("en-CA",{timeZone:c.timezone??"America/Denver"}).format(now);
 const rank=(c:MapCase)=>/withdrawn|cancelled|canceled/i.test(c.recordStatus??c.statusNote??"")?3:c.nextHearing&&c.nextHearing.date>=today(c)&&!["Decided","Recorded"].includes(c.stage)?0:["Decided","Recorded"].includes(c.stage)?2:1;
 const ar=rank(a),br=rank(b);if(ar!==br)return ar-br;
 if(ar===0)return a.nextHearing!.date.localeCompare(b.nextHearing!.date);
 const date=(c:MapCase)=>c.decisionDate??c.caseDate??(c.id.match(/20\d{2}/)?.[0]??"");
 return date(b).localeCompare(date(a));
}
/** Namespaced identifiers prevent identical case numbers in different cities colliding. */
export function combineRadiusCases(input:{area:AreaDefinition;cases:MapCase[]}[],coordinates:[number,number],miles:number,now=new Date()){
 const groups:MapCase[]=[];
 for(const {area:a,cases}of [...input].sort((a,b)=>Number(a.area.type==="county")-Number(b.area.type==="county")))for(const c of nearbyCases(cases,coordinates,miles)){
  const body=c.stageBody??c.nextHearing?.body??stageBody(c.stage,a),member={areaId:a.id,caseId:c.id,title:c.title,href:canonicalAreaHref(a.id,c.href),stage:c.stage,body,date:c.nextHearing?.date??c.decisionDate??c.caseDate,status:c.recordStatus};
  const candidate={...c,timezone:a.timezone,id:a.id+":"+c.id,areaId:a.id,jurisdictionLabel:jurisdictionLabel(a),stageBody:body,caseIds:[c.id],members:[member],href:member.href};
  const existing=groups.find(g=>sameSite(g,candidate));
  if(!existing){groups.push(candidate);continue;}
  let geometry=existing.geometry;
  if(geometry&&c.geometry)try{geometry=union(featureCollection([feature(geometry),feature(c.geometry)]))?.geometry??geometry;}catch{/* Preserve verified geometry on malformed rings. */}
  const members=[...existing.members!,member],ids=[...new Set([...existing.caseIds!,c.id])];
  if(compareSiteLead(candidate,existing,now)<0)Object.assign(existing,candidate);
  const leadId=existing.id.split(":").at(-1);
  existing.members=members.sort((x,y)=>Number(y.caseId===leadId&&y.areaId===existing.areaId)-Number(x.caseId===leadId&&x.areaId===existing.areaId));
  existing.caseIds=ids;existing.geometry=geometry;if(geometry)existing.centroid=geometryCentroid(geometry);
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
export function clipCombinedFlum(layers:{area:AreaDefinition;flum:FlumCache;categoryField:string}[],cities:AreaDefinition[],coordinates:[number,number],miles:number,viewBounds?:readonly number[]):FlumCache{
 const bounds=viewBounds??radiusBounds(coordinates,miles),clip=boundsPolygon(bounds);
 const tolerance=Math.max(.000005,Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1])/1500);
 const light=(f:Feature<CaseGeometry>)=>{try{return simplify(f,{tolerance,highQuality:false});}catch{return f;}};
 const lightCities=cities.filter(c=>boxesOverlap(c.boundary,clip.geometry)).map(c=>({id:c.id,shape:light(feature(c.boundary))}));
 const features:Feature<CaseGeometry>[]=[],countyFeatures:Feature<CaseGeometry>[]=[];
 for(const layer of layers){
  // City plans can cover unannexed land. The published plan extent, not city limits, controls the layer.
  const coverage=clip;
  for(const f of layer.flum.geojson.features){
   if(!boxesOverlap(f.geometry,coverage.geometry))continue;
   try{const simplified=light(f),box=bbox(simplified);let shape:Feature<CaseGeometry>|null=box[0]>=bounds[0]&&box[1]>=bounds[1]&&box[2]<=bounds[2]&&box[3]<=bounds[3]?simplified:intersect(featureCollection([simplified,coverage]));if(!shape)continue;
    if(layer.area.type==="city")for(const city of lightCities){if(!shape)break;if(city.id!==layer.area.id&&boxesOverlap(shape.geometry,city.shape.geometry))shape=difference(featureCollection([shape,city.shape]));}
    if(!shape)continue;
    const category=String(f.properties?.[layer.categoryField]??"Unknown"),label=layer.flum.legend.find(l=>l.value===category)?.label??category,group=flumGroup(label);
    const output={...shape,properties:{category,group,jurisdiction:jurisdictionLabel(layer.area),plan:layer.area.name+" Future Land Use"}};
    (layer.area.type==="city"?features:countyFeatures).push(output);
   }catch{/* A malformed polygon cannot establish a designation. */}
  }
 }
 // County color must not tint a city plan's category where its published plan extends outside city limits.
 const cityMasks=features.slice(),boxes=cityMasks.map(f=>bbox(f)),grid=new Map<string,Set<number>>(),large:number[]=[];
 const cell=Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1])/64;
 const cells=(b:readonly number[])=>{const keys:string[]=[];for(let x=Math.max(0,Math.floor((b[0]-bounds[0])/cell));x<=Math.min(64,Math.floor((b[2]-bounds[0])/cell));x++)for(let y=Math.max(0,Math.floor((b[1]-bounds[1])/cell));y<=Math.min(64,Math.floor((b[3]-bounds[1])/cell));y++)keys.push(x+":"+y);return keys;};
 for(let i=0;i<cityMasks.length;i++){const keys=cells(boxes[i]);if(keys.length>256){large.push(i);continue;}for(const key of keys){const ids=grid.get(key)??new Set<number>();ids.add(i);grid.set(key,ids);}}
 for(const county of countyFeatures){
  const box=bbox(county),ids=new Set(large);for(const key of cells(box))for(const id of grid.get(key)??[])ids.add(id);
  const candidates=[...ids].filter(i=>boxes[i][0]<=box[2]&&boxes[i][2]>=box[0]&&boxes[i][1]<=box[3]&&boxes[i][3]>=box[1]).map(i=>cityMasks[i]);
  try{const shape=candidates.length?difference(featureCollection([county,...candidates])):county;if(shape)features.push({...shape,properties:county.properties});}catch{/* Invalid masks must not recolor a city plan. */}
 }
 const groups=new Set(features.map(f=>f.properties!.group));
 return {updatedAt:layers.map(l=>l.flum.updatedAt).sort()[0]??new Date().toISOString(),geojson:{type:"FeatureCollection",features} as FeatureCollection<CaseGeometry>,legend:Object.entries(COMMON_FLUM).filter(([g])=>groups.has(g)).map(([value,color])=>({value,label:value,color}))};
}
