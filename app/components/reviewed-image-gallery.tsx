"use client";
import { useState } from "react";
import Image from "next/image";
import type { MapVisual } from "@/lib/maps/types";
import { approvedImageCheck } from "@/lib/maps/image-policy";
import MapImageViewer from "./maps/map-image-viewer";
export default function ReviewedImageGallery({visuals}:{visuals:MapVisual[]}){
 const [expanded,setExpanded]=useState<MapVisual>();
 const [failed,setFailed]=useState<string[]>([]);
 const safe=visuals.filter(v=>approvedImageCheck(v.approval)&&!failed.includes(v.src));if(!safe.length)return null;
 return <section className="space-y-4" aria-label="Project plans and exhibits"><div className="grid gap-5 sm:grid-cols-2">{safe.map(v=><figure key={v.src} className="space-y-2"><button type="button" className="w-full cursor-zoom-in rounded-lg border bg-white p-2" onClick={()=>setExpanded(v)} aria-label={"Enlarge "+v.label}><Image src={v.src} alt={v.alt} width={800} height={420} unoptimized onError={()=>setFailed(prior=>[...prior,v.src])} className="max-h-64 w-full object-contain"/></button><figcaption className="text-xs text-zinc-500"><a href={v.sourceUrl} className="underline">{v.label}</a></figcaption></figure>)}</div>{expanded&&<MapImageViewer visual={expanded} onClose={()=>setExpanded(undefined)}/>}</section>;
}
