"use client";
/* eslint-disable @next/next/no-img-element -- approved source exhibits use the cached visual endpoint. */
import {projectJsonLd} from "@/lib/project-seo-jsonld";
import {useState} from "react";
import type {PaneData} from "@/lib/maps/project-questions";
import ProjectPane from "./project-pane";
import {hearingDateTime} from "@/lib/areas/format";
import ProjectLocationMap from "./project-location-map";
import "./map-home.css";
import type {MapVisual} from "@/lib/maps/types";
export default function ProjectPage({data}:{data:PaneData}){
 const [image,setImage]=useState<MapVisual>();
 return <main className="mx-auto w-full max-w-4xl px-5 py-8"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(projectJsonLd(data)).replace(/</g,"\\u003c")}}/><a className="underline" href={"/?project="+data.area.id+"/"+data.item.id}>View on map →</a><p className="my-3 text-sm text-zinc-500">As of {hearingDateTime(data.updatedAt,data.area.timezone)}</p><ProjectPane page data={data} onClose={()=>location.assign("/")} onImage={setImage} onWatch={()=>location.assign("/?project="+data.area.id+"/"+data.item.id+"&watch=1")}/><ProjectLocationMap areaId={data.area.id} caseIds={data.caseIds}/>{image&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-5" role="dialog" aria-label="Project exhibit"><button className="absolute right-5 top-5 rounded bg-white px-4 py-2 text-black" onClick={()=>setImage(undefined)}>Close image</button><img className="max-h-[85vh] max-w-full object-contain" src={image.fullSizeUrl??image.src} alt={image.alt}/></div>}</main>;
}
