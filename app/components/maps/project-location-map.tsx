"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
const CaseMap = dynamic(() => import("./case-map"), { ssr: false, loading: () => <p>Loading project map…</p> });
export default function ProjectLocationMap({areaId,caseIds}:{areaId:string;caseIds:string[]}) {
 const container=useRef<HTMLElement>(null),[visible,setVisible]=useState(false);
 useEffect(()=>{if(!container.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"200px"});observer.observe(container.current);return()=>observer.disconnect();},[]);
 return <section ref={container} aria-label="Project location map" className="mt-8 min-h-80"><h2 className="mb-3 text-xl font-semibold">Project location map</h2><p className="mb-3 text-sm">The map shows the tracked project area. An approximate boundary is not a proposed site plan.</p>{visible?<CaseMap jurisdiction={areaId} caseIds={caseIds} compact/>:<p>The interactive map loads as you scroll here.</p>}</section>;
}
