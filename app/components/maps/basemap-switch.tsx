"use client";
import {useId,useState,useSyncExternalStore,type ReactNode} from "react";
import {useMapMenu} from "./use-map-menu";
import {basemapChoice,chooseBasemap,subscribeBasemap} from "@/lib/maps/basemap-choice";
import "./basemap-switch.css";

export default function BasemapSwitch(){
  const mode=useSyncExternalStore(subscribeBasemap,basemapChoice,()=>"map");
  return <div className="law-basemap-switch" role="group" aria-label="Basemap">
    <button type="button" aria-pressed={mode==="map"} onClick={()=>chooseBasemap("map")}>Map</button>
    <button type="button" aria-pressed={mode==="satellite"} onClick={()=>chooseBasemap("satellite")}>Satellite</button>
  </div>;
}
export function BasemapLayers({children}:{children?:ReactNode}){
  const [open,setOpen]=useState(false),menu=useMapMenu(open,setOpen),id=useId();
  return <details className="law-basemap-layers" open={open}><summary {...menu.triggerProps} aria-expanded={open} aria-controls={id}>Layers</summary><div {...menu.panelProps} id={id} className="law-basemap-options"><BasemapSwitch/>{children}</div></details>;
}
