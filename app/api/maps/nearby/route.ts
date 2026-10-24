import { enrichMapPopups } from "@/lib/maps/popup-data";
import {bbox,featureCollection,feature,distance} from "@turf/turf";
import {AREAS} from "@/lib/areas/registry";
import {getJurisdiction} from "@/lib/maps/jurisdictions";
import {readFlumSnapshot,readMapSnapshot} from "@/lib/maps/store";
import {publicMapData} from "@/lib/maps/refresh";
import {clipCombinedFlum,combineRadiusCases,liveAreasInRadius,liveAreasInBounds,parseMapBounds,radiusBounds} from "@/lib/maps/radius";
import {isLonLat,type PublicMapData} from "@/lib/maps/types";
export const runtime="nodejs";
export const maxDuration=120;
export async function GET(request:Request){
 const q=new URL(request.url).searchParams;
 let coordinates:[number,number]=[Number(q.get("lng")),Number(q.get("lat"))];const r=Number(q.get("r")??1),overview=q.get("overview")==="1",viewBounds=parseMapBounds(q.get("bbox"));
 if(q.has("bbox")&&!viewBounds)return Response.json({error:"Invalid map bounds."},{status:400});
 if(!overview&&!viewBounds&&(!q.get("lng")||!q.get("lat")||!isLonLat(coordinates)||!Number.isFinite(r)||r<.25||r>10))return Response.json({error:"Choose a location and a radius from 0.25 to 10 miles."},{status:400});
 const coverage=Object.values(AREAS).filter(a=>a.status==="live"&&(!q.get("country")||a.country===q.get("country"))&&(!q.get("state")||a.state===q.get("state")));
 if(overview&&!coverage.length)return Response.json({error:"No tracked areas."},{status:404});
 const bounds=viewBounds??(overview?bbox(featureCollection(coverage.map(a=>feature(a.boundary)))).slice(0,4) as [number,number,number,number]:radiusBounds(coordinates,r));
 const areas=overview?coverage:viewBounds?liveAreasInBounds(bounds):liveAreasInRadius(coordinates,r);
 if(overview||viewBounds)coordinates=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2];
 const warnings:string[]=[],flum=q.get("layer")==="flum";
 if(flum){
  const planAreas=Object.values(AREAS).filter(a=>a.status==="live"&&getJurisdiction(a.id)?.flum.layerUrl);
  const layers=await Promise.all(planAreas.map(async area=>{const config=getJurisdiction(area.id);if(!config?.flum.layerUrl)return;try{const data=await readFlumSnapshot(area.id,{bounds});if(data)return {area,flum:data,categoryField:config.flum.categoryField};}catch{}warnings.push(area.name+" future land use unavailable.");}));
  const data=clipCombinedFlum(layers.filter(l=>l!==undefined),Object.values(AREAS).filter(a=>a.type==="city"),coordinates,r,bounds);
  return Response.json({...data,warnings},{headers:{"Cache-Control":"public, max-age=300, s-maxage=300"}});
 }
 const snapshots=await Promise.all(areas.map(async area=>{
  const config=getJurisdiction(area.id);if(!config)return;
  try{const snapshot=await readMapSnapshot(area.id,{bounds,includeFlum:false});if(snapshot)return {area,snapshot,cases:await enrichMapPopups(config,publicMapData(config,snapshot).cases)};}catch{}
  warnings.push(area.name+" project data is temporarily unavailable.");
 }));
 const found=snapshots.filter(s=>s!==undefined),cases=combineRadiusCases(found,coordinates,overview||viewBounds?Math.max(distance(coordinates,[bounds[0],bounds[1]],{units:"miles"}),distance(coordinates,[bounds[2],bounds[3]],{units:"miles"}))+1:r);
 const data:PublicMapData={overview,areas:areas.map(a=>({id:a.id,name:a.name})),boundaries:{type:"FeatureCollection",features:areas.filter(a=>a.type==="city").map(a=>({type:"Feature",geometry:a.boundary,properties:{name:a.name}}))},jurisdiction:{id:"nearby",name:"All nearby jurisdictions",center:coordinates,zoom:overview?9:13,bounds,state:{abbreviation:areas[0]?.stateAbbreviation??q.get("state")?.toUpperCase()??"",fips:"",name:areas[0]?.stateName??""},addressPoints:{layerUrl:"",addressField:"",where:"1=1",suffix:""}},updatedAt:found.map(s=>s.snapshot.updatedAt).sort()[0]??new Date().toISOString(),cases,warnings:[...warnings,...found.flatMap(s=>s.snapshot.warnings.map(w=>s.area.name+": "+w))],flum:{layerUrl:areas.some(a=>a.sources.flum)?"combined":"",categoryField:"group",colorSource:"renderer",planName:"Jurisdiction Future Land Use",label:"Published city plans, including unannexed areas; county plan elsewhere",adoptedDate:null,adoptionSource:"",simplifyTolerance:0,legend:[],dataNote:"Plans may extend beyond city limits. Select a colored area for its source and official designation; these groups do not establish zoning compatibility."}};
 return Response.json(data,{headers:{"Cache-Control":"public, max-age=300, s-maxage=300"}});
}
