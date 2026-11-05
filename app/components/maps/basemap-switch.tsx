"use client";
import {useSyncExternalStore,type ReactNode} from "react";
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
  return <details className="law-basemap-layers"><summary>Layers</summary><div className="law-basemap-options"><BasemapSwitch/>{children}</div></details>;
}
