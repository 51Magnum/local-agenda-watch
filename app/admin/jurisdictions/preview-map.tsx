"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {FeatureCollection} from "geojson";
import type {Map as LibreMap} from "maplibre-gl";
import type {PaneData} from "@/lib/maps/project-questions";
import {previewMapData} from "@/lib/jurisdictions/preview-map-data";
import ProjectPane from "@/app/components/maps/project-pane";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/components/maps/map.css";
import "@/app/components/maps/map-home.css";
export default function PreviewMap({boundaries,cases}:{boundaries:FeatureCollection;cases:FeatureCollection}){
 const container=useRef<HTMLDivElement>(null),map=useRef<LibreMap|null>(null);
 const [selected,setSelected]=useState<PaneData>(),[error,setError]=useState(""),[loaded,setLoaded]=useState(false);
 const data=useMemo(()=>previewMapData(boundaries,cases),[boundaries,cases]);
 useEffect(()=>{
  let active=true;
  void import("maplibre-gl").then(lib=>{
   if(!active||!container.current)return;
   const m=new lib.Map({container:container.current,style:"https://tiles.openfreemap.org/styles/liberty",center:[-116.24,43.55],zoom:10});
   map.current=m;m.addControl(new lib.NavigationControl({showCompass:false}),"bottom-right");
   m.on("error",()=>{if(active)setError("Some map data could not load. Project records are available in the list below.");});
   m.on("load",()=>{
    if(!active)return;
    try{
     m.addSource("qa-boundaries",{type:"geojson",data:boundaries});
     m.addLayer({id:"qa-boundaries",type:"fill",source:"qa-boundaries",paint:{"fill-color":["get","color"],"fill-opacity":.12}});
     m.addLayer({id:"qa-outlines",type:"line",source:"qa-boundaries",paint:{"line-color":["get","color"],"line-width":2}});
     m.addSource("qa-cases",{type:"geojson",data:cases});
     m.addLayer({id:"qa-cases",type:"fill",source:"qa-cases",paint:{"fill-color":["get","color"],"fill-opacity":.5}});
     m.addLayer({id:"qa-case-outlines",type:"line",source:"qa-cases",paint:{"line-color":["get","color"],"line-width":2}});
     m.addSource("qa-project-markers",{type:"geojson",data:data.markers});
     m.addLayer({id:"qa-project-markers",type:"circle",source:"qa-project-markers",paint:{"circle-radius":7,"circle-color":["get","color"],"circle-stroke-color":"#ffffff","circle-stroke-width":2}});
     if(data.bounds)m.fitBounds(data.bounds,{padding:55,maxZoom:13,duration:0});
     setLoaded(true);
     m.on("mouseenter","qa-project-markers",()=>{m.getCanvas().style.cursor="pointer";});
     m.on("mouseleave","qa-project-markers",()=>{m.getCanvas().style.cursor="";});
     m.on("click",async event=>{
      const p=m.queryRenderedFeatures(event.point,{layers:["qa-project-markers","qa-cases"]})[0]?.properties;if(!p)return;
      try{const r=await fetch("/admin/jurisdictions/"+encodeURIComponent(p.areaId)+"/project?case="+encodeURIComponent(p.caseId),{cache:"no-store"});if(!r.ok)throw Error("Project unavailable");const project=await r.json();if(active){setSelected(project);setError("");}}
      catch{if(active)setError("Private project preview could not be loaded. Open the record in the project list below.");}
     });
    }catch{setError("Project layers could not load. Project records are available in the list below.");}
   });
  }).catch(()=>{if(active)setError("Map could not load. Project records are available in the list below.");});
  return()=>{active=false;map.current?.remove();map.current=null;};
 },[boundaries,cases,data]);
 return <section aria-label="Private project map" className="space-y-2">
  <p role="status" className="text-sm">{error?"Map needs attention. ":!loaded?"Loading map… ":""}{data.markers.features.length} projects with verified mapped boundaries. {data.markers.features.length?"Select a colored marker to open a project.":"No project location is verified for this view."}</p>
  <div className="relative h-[65vh] min-h-[440px] overflow-hidden rounded-xl border">
   <div ref={container} className="h-full w-full"/>
   {selected&&<ProjectPane key={selected.area.id+selected.item.id} data={selected} preview onClose={()=>setSelected(undefined)} onWatch={()=>{}} onImage={v=>window.open(v.fullSizeUrl,"_blank","noopener,noreferrer")}/>}
   <p className="pointer-events-none absolute right-3 top-3 rounded bg-white p-2 text-sm text-slate-900">Admin preview · Not public</p>
   {data.bounds&&<button type="button" className="absolute bottom-8 left-3 min-h-11 rounded border bg-white px-3 text-sm text-slate-900 shadow" onClick={()=>map.current?.fitBounds(data.bounds!,{padding:55,maxZoom:13,duration:0})}>Show all mapped projects</button>}
   {error&&<p role="alert" className="absolute bottom-24 left-3 right-3 rounded bg-white p-3 text-sm text-slate-900">{error}</p>}
  </div>
 </section>;
}
