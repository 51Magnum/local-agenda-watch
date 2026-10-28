"use client";
import {useEffect,useRef,useState} from "react";
import type {Map as LibreMap,Popup} from "maplibre-gl";
import {bbox} from "@turf/turf";
import {areaPath,type AreaDefinition} from "@/lib/areas/public-registry";
import {coverageColor,coverageLabel} from "@/lib/areas/coverage-style";
import "maplibre-gl/dist/maplibre-gl.css";
export default function CoverageMap({areas}:{areas:AreaDefinition[]}){
 const ref=useRef<HTMLDivElement>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  let map:LibreMap|undefined,resize:ResizeObserver|undefined,popup:Popup|undefined,disposed=false;
  import("maplibre-gl").then(lib=>{
   if(disposed||!ref.current)return;
   lib.setWorkerUrl("/maplibre/worker.mjs");
   map=new lib.Map({container:ref.current,style:"https://tiles.openfreemap.org/styles/liberty",center:areas[0]?.center??[-98,39],zoom:6,scrollZoom:false,attributionControl:{compact:true}});
   resize=new ResizeObserver(()=>map?.resize());resize.observe(ref.current);
   map.addControl(new lib.NavigationControl({showCompass:false}),"top-right");
   map.on("load",()=>{
    if(!map)return;
    const data={type:"FeatureCollection" as const,features:areas.map(a=>({type:"Feature" as const,geometry:a.coverageBoundary??a.boundary,properties:{id:a.id,status:a.status,type:a.type,color:coverageColor(a)}}))};
    map.addSource("coverage",{type:"geojson",data});
    map.addLayer({id:"coverage-fill",type:"fill",source:"coverage",paint:{"fill-color":["get","color"],"fill-opacity":["case",["all",["==",["get","status"],"live"],["==",["get","type"],"city"]],.35,0]}});
    const county=["all",["==",["get","status"],"live"],["==",["get","type"],"county"]] as import("maplibre-gl").FilterSpecification;
    map.addLayer({id:"coverage-county-halo",type:"line",source:"coverage",filter:county,paint:{"line-color":"#fff","line-width":6,"line-opacity":.85}});
    map.addLayer({id:"coverage-county-border",type:"line",source:"coverage",filter:county,paint:{"line-color":["get","color"],"line-width":3.2}});
    map.addLayer({id:"coverage-city-border",type:"line",source:"coverage",filter:["all",["==",["get","status"],"live"],["==",["get","type"],"city"]],paint:{"line-color":["get","color"],"line-width":1.8}});
    map.addLayer({id:"coverage-planned-border",type:"line",source:"coverage",filter:["!=",["get","status"],"live"],paint:{"line-color":"#64748b","line-width":2,"line-dasharray":[3,2]}});
    const bounds=bbox(data);map.fitBounds([[bounds[0],bounds[1]],[bounds[2],bounds[3]]],{padding:35,maxZoom:10,duration:0});
    const areaAt=(features?:{properties?:Record<string,unknown>|null}[])=>{
     const ids=(features??[]).map(f=>String(f.properties?.id));
     return areas.find(a=>ids.includes(a.id)&&a.type==="city"&&a.status==="live")??areas.find(a=>ids.includes(a.id)&&a.status==="live")??areas.find(a=>ids.includes(a.id));
    };
    map.on("click","coverage-fill",event=>{const area=areaAt(event.features);if(area)window.location.assign(areaPath(area)+(area.status==="live"?"/map":""));});
    map.on("mousemove","coverage-fill",event=>{
     if(!map)return;map.getCanvas().style.cursor="pointer";const area=areaAt(event.features);if(!area)return;
     popup??=new lib.Popup({closeButton:false,closeOnClick:false,offset:12,className:"law-coverage-popup"});
     popup.setLngLat(event.lngLat).setText(coverageLabel(area)+" · "+(area.status==="live"?"Live":"Coming soon")).addTo(map);
    });
    map.on("mouseleave","coverage-fill",()=>{if(map)map.getCanvas().style.cursor="";popup?.remove();});
   });
  }).catch(()=>setFailed(true));
  return()=>{disposed=true;popup?.remove();resize?.disconnect();map?.remove();};
 },[areas]);
 return <div className="flex min-h-0 flex-col lg:max-h-[70vh]">
  <div ref={ref} role="region" aria-label="Coverage map: cities have colored fills, county coverage has a bold outline, coming-soon areas have dashed gray boundaries" className="h-[300px] shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 lg:h-auto lg:min-h-0 lg:flex-1 dark:border-zinc-800"/>
  {failed&&<p className="mt-2 text-sm text-zinc-500">Map unavailable. Choose an area from the list.</p>}
  <div aria-label="Coverage legend" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
   {areas.filter(a=>a.status==="live").map(area=><a key={area.id} href={areaPath(area)+"/map"} className="inline-flex items-center gap-1.5 hover:underline"><span aria-hidden="true" className={"inline-block h-3 w-3 rounded-sm "+(area.type==="county"?"border-[3px]":"border")} style={{borderColor:coverageColor(area),backgroundColor:area.type==="county"?"transparent":coverageColor(area)+"66"}}/>{coverageLabel(area)}</a>)}
   <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-4 border-2 border-dashed border-slate-500"/>Coming soon</span>
  </div>
 </div>;
}
