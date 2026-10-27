"use client";
import {useEffect,useRef,useState} from "react";
import type {FeatureCollection} from "geojson";
import type {Map as LibreMap} from "maplibre-gl";
import type {PaneData} from "@/lib/maps/project-questions";
import ProjectPane from "@/app/components/maps/project-pane";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/components/maps/map.css";
import "@/app/components/maps/map-home.css";
export default function PreviewMap({boundaries,cases}:{boundaries:FeatureCollection;cases:FeatureCollection}){
 const container=useRef<HTMLDivElement>(null),map=useRef<LibreMap>(null),[selected,setSelected]=useState<PaneData>(),[error,setError]=useState("");
 useEffect(()=>{let active=true;void import("maplibre-gl").then(lib=>{if(!active||!container.current)return;const m=new lib.Map({container:container.current,style:"https://tiles.openfreemap.org/styles/liberty",center:[-116.24,43.55],zoom:10});map.current=m;m.on("load",()=>{m.addSource("qa-boundaries",{type:"geojson",data:boundaries});m.addLayer({id:"qa-boundaries",type:"fill",source:"qa-boundaries",paint:{"fill-color":["get","color"],"fill-opacity":.15}});m.addLayer({id:"qa-outlines",type:"line",source:"qa-boundaries",paint:{"line-color":["get","color"],"line-width":2}});m.addSource("qa-cases",{type:"geojson",data:cases});m.addLayer({id:"qa-cases",type:"fill",source:"qa-cases",paint:{"fill-color":["get","color"],"fill-opacity":.65}});m.on("click","qa-cases",async e=>{const p=e.features?.[0]?.properties;if(!p)return;const r=await fetch("/admin/jurisdictions/"+encodeURIComponent(p.areaId)+"/project?case="+encodeURIComponent(p.caseId),{cache:"no-store"});if(r.ok)setSelected(await r.json());else setError("Private project preview could not be loaded.");});});}).catch(()=>setError("Map could not load."));return()=>{active=false;map.current?.remove();map.current=null;};},[boundaries,cases]);
 return <div className="relative h-[75vh] min-h-[500px] overflow-hidden rounded-xl border"><div ref={container} className="h-full w-full"/>{selected&&<ProjectPane key={selected.area.id+selected.item.id} data={selected} preview onClose={()=>setSelected(undefined)} onWatch={()=>{}} onImage={v=>window.open(v.fullSizeUrl,"_blank","noopener,noreferrer")}/>}<p className="absolute right-3 top-3 rounded bg-white p-2 text-sm text-slate-900">Admin preview · Not public</p>{error&&<p role="status" className="absolute bottom-3 bg-white p-3">{error}</p>}</div>;
}
