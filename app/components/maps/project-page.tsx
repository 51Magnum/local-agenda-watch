"use client";
import {useState} from "react";
import type {PaneData} from "@/lib/maps/project-questions";
import ProjectPane from "./project-pane";
import type {MapVisual} from "@/lib/maps/types";
export default function ProjectPage({data}:{data:PaneData}){
 const [image,setImage]=useState<MapVisual>();
 return <main className="mx-auto w-full max-w-4xl px-5 py-8"><a className="underline" href={"/?project="+data.area.id+"/"+data.item.id}>View on map →</a><ProjectPane page data={data} onClose={()=>location.assign("/")} onImage={setImage} onWatch={()=>location.assign("/?project="+data.area.id+"/"+data.item.id+"&watch=1")}/>{image&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-5" role="dialog" aria-label="Project exhibit"><button className="absolute right-5 top-5 rounded bg-white px-4 py-2 text-black" onClick={()=>setImage(undefined)}>Close image</button><img className="max-h-[85vh] max-w-full object-contain" src={image.fullSizeUrl??image.src} alt={image.alt}/></div>}</main>;
}
