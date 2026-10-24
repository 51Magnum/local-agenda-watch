import {AREAS} from "@/lib/areas/registry";
import {getJurisdiction} from "@/lib/maps/jurisdictions";
import {readFlumSnapshot,readMapSnapshot} from "@/lib/maps/store";
import {publicMapData} from "@/lib/maps/refresh";
import {clipCombinedFlum,combineRadiusCases,liveAreasInRadius,radiusBounds} from "@/lib/maps/radius";
import {isLonLat,type PublicMapData} from "@/lib/maps/types";
export const runtime="nodejs";
export const maxDuration=120;
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,coordinates:[number,number]=[Number(q.get("lng")),Number(q.get("lat"))],r=Number(q.get("r")??1);
 if(!q.get("lng")||!q.get("lat")||!isLonLat(coordinates)||!Number.isFinite(r)||r<.25||r>10)return Response.json({error:"Choose a location and a radius from 0.25 to 10 miles."},{status:400});
 const areas=liveAreasInRadius(coordinates,r).filter(a=>(!q.get("country")||a.country===q.get("country"))&&(!q.get("state")||a.state===q.get("state")));
 const bounds=radiusBounds(coordinates,r),warnings:string[]=[],flum=q.get("layer")==="flum";
 if(flum){
  const layers=await Promise.all(areas.map(async area=>{const config=getJurisdiction(area.id);if(!config?.flum.layerUrl)return;try{const data=await readFlumSnapshot(area.id,{bounds});if(data)return {area,flum:data,categoryField:config.flum.categoryField};}catch{}warnings.push(area.name+" future land use unavailable.");}));
  const data=clipCombinedFlum(layers.filter(l=>l!==undefined),Object.values(AREAS).filter(a=>a.type==="city"),coordinates,r);
  return Response.json({...data,warnings},{headers:{"Cache-Control":"public, max-age=300, s-maxage=300"}});
 }
 const snapshots=await Promise.all(areas.map(async area=>{
  const config=getJurisdiction(area.id);if(!config)return;
  try{const snapshot=await readMapSnapshot(area.id,{bounds,includeFlum:false});if(snapshot)return {area,snapshot,cases:publicMapData(config,snapshot).cases};}catch{}
  warnings.push(area.name+" project data is temporarily unavailable.");
 }));
 const found=snapshots.filter(s=>s!==undefined),cases=combineRadiusCases(found,coordinates,r);
 const data:PublicMapData={areas:areas.map(a=>({id:a.id,name:a.name})),boundaries:{type:"FeatureCollection",features:areas.filter(a=>a.type==="city").map(a=>({type:"Feature",geometry:a.boundary,properties:{name:a.name}}))},jurisdiction:{id:"nearby",name:"All nearby jurisdictions",center:coordinates,zoom:13,bounds,state:{abbreviation:areas[0]?.stateAbbreviation??q.get("state")?.toUpperCase()??"",fips:"",name:areas[0]?.stateName??""},addressPoints:{layerUrl:"",addressField:"",where:"1=1",suffix:""}},updatedAt:found.map(s=>s.snapshot.updatedAt).sort()[0]??new Date().toISOString(),cases,warnings:[...warnings,...found.flatMap(s=>s.snapshot.warnings.map(w=>s.area.name+": "+w))],flum:{layerUrl:areas.some(a=>a.sources.flum)?"combined":"",categoryField:"group",colorSource:"renderer",planName:"Jurisdiction Future Land Use",label:"City plans inside city limits; county plan outside incorporated cities",adoptedDate:null,adoptionSource:"",simplifyTolerance:0,legend:[],dataNote:"Display groups only; select a parcel for its official designation. Plan designations do not establish zoning compatibility."}};
 return Response.json(data,{headers:{"Cache-Control":"public, max-age=300, s-maxage=300"}});
}
