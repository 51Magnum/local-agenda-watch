"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import type {Map as LibreMap,Marker} from "maplibre-gl";
import {parseSavedMapPins,type SavedMapPin} from "@/lib/maps/saved-pins";
type Props={open:boolean;ready:boolean;getMap:()=>LibreMap|null;selectedId?:string;onSelect:(pin:SavedMapPin)=>void;onRefreshSelected:(pin:SavedMapPin)=>void;onHide:()=>void};
export default function SavedPinsLayer({open,ready,getMap,selectedId,onSelect,onRefreshSelected,onHide}:Props){
 const [pins,setPins]=useState<SavedMapPin[]>([]),[status,setStatus]=useState<"loading"|"ready"|"anonymous"|"preview"|"error">("loading"),[enabled,setEnabled]=useState(true),[retry,setRetry]=useState(0);
 const requested=useRef(false),callbacks=useRef({onSelect,onRefreshSelected,onHide});
 useEffect(()=>{callbacks.current={onSelect,onRefreshSelected,onHide};});
 useEffect(()=>{
  if(!open&&!requested.current)return;
  requested.current=true;const abort=new AbortController();let serial=0;
  async function refresh(){
   const current=++serial;
   try{
    const response=await fetch("/api/account/pins",{credentials:"same-origin",cache:"no-store",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});
    const currentRequest=()=>!abort.signal.aborted&&current===serial;
    if(response.status===401||response.status===403){if(currentRequest()){setPins([]);setStatus(response.status===401?"anonymous":"preview");callbacks.current.onHide();}return;}
    if(!response.ok)throw Error("Saved pins unavailable");
    const data=parseSavedMapPins(await response.json());if(!currentRequest())return;
    setPins(data);setStatus("ready");if(selectedId){const selected=data.find(p=>p.id===selectedId);if(selected)callbacks.current.onRefreshSelected(selected);else callbacks.current.onHide();}
   }catch{if(!abort.signal.aborted&&current===serial){setPins([]);setStatus("error");callbacks.current.onHide();}}
  }
  void refresh();const focus=()=>{if(document.visibilityState==="visible")void refresh();};
  window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);
  const timer=enabled?setInterval(focus,60000):undefined;
  return()=>{abort.abort();window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);if(timer)clearInterval(timer);};
 },[open,retry,enabled,selectedId]);
 useEffect(()=>{
  if(!enabled||status!=="ready"||!ready)return;
  const map=getMap();if(!map)return;let disposed=false;const markers:Marker[]=[];
  void import("maplibre-gl").then(lib=>{
   if(disposed)return;
   pins.forEach((pin,index)=>{
    const button=document.createElement("button");button.type="button";button.className="law-saved-pin-marker";button.textContent=String(index+1);
    button.title=pin.label;button.setAttribute("aria-label",`Show saved pin ${pin.label}, ${pin.radiusMiles} ${pin.radiusMiles===1?"mile":"miles"}`);button.setAttribute("aria-pressed",String(pin.id===selectedId));
    button.addEventListener("click",event=>{event.stopPropagation();callbacks.current.onSelect(pin);});
    markers.push(new lib.Marker({element:button,anchor:"bottom"}).setLngLat(pin.coordinates).addTo(map));
   });
  }).catch(()=>{});
  return()=>{disposed=true;markers.forEach(marker=>marker.remove());};
 },[pins,enabled,status,ready,getMap,selectedId]);
 return <fieldset className="law-saved-pins-layer"><legend>Your saved pins</legend>
  {status==="loading"&&<p role="status">Loading your saved pins…</p>}
  {status==="anonymous"&&<p><Link href="/sign-in?next=%2F%3FsavedPins%3D1">Sign in to show your saved pins</Link></p>}
  {status==="preview"&&<p>Saved pins are not available in preview.</p>}
  {status==="error"&&<p role="alert">Your saved pins could not load. <button onClick={()=>setRetry(n=>n+1)}>Try again</button></p>}
  {status==="ready"&&<><label><input type="checkbox" checked={enabled} disabled={!pins.length} onChange={e=>{setEnabled(e.target.checked);if(!e.target.checked)onHide();}}/>Show saved pins{pins.length?` (${pins.length})`:""}</label>
   {!pins.length?<p>No active saved pins yet.</p>:<ol>{pins.map((pin,index)=><li key={pin.id}><button className="law-saved-pin-choice" aria-pressed={pin.id===selectedId} onClick={()=>{setEnabled(true);onSelect(pin);}}><span>{index+1}. {pin.label}</span><small>{pin.radiusMiles} {pin.radiusMiles===1?"mile":"miles"} · Alerts {pin.alertsEnabled?"on":"off"}</small></button></li>)}</ol>}
   <Link href="/pins">Manage saved pins</Link></>}
 </fieldset>;
}
