"use client";
import Link from "next/link";
import {useId,useState} from "react";
import {AREAS} from "@/lib/areas/public-registry";
export default function InterestForm({kind="coverage",areaName="",coordinates,radiusMiles=1,place=false,onSaved}:{onSaved?:()=>void;radiusMiles?:number;place?:boolean;kind?:"coverage"|"follow";areaName?:string;coordinates?:[number,number]}){
 const areas=Object.values(AREAS).map(a=>({id:a.id,label:a.name+", "+a.stateAbbreviation})).sort((a,b)=>a.label.localeCompare(b.label));
 const [customArea,setCustomArea]=useState(Boolean(areaName&&areaName!=="Any area"&&!areas.some(a=>a.label===areaName)));
 const id=useId(),[area,setArea]=useState(areaName==="Any area"?"":areaName),[address,setAddress]=useState(""),[interests,setInterests]=useState(""),[email,setEmail]=useState(""),[website,setWebsite]=useState(""),[message,setMessage]=useState(""),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
 const input="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
 return <form className="mt-5 space-y-4" onSubmit={async event=>{
  event.preventDefault();setSaving(true);setMessage("");
  try{
   const response=await fetch("/api/coverage-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,areaRequested:area,email,address,interests,website,radiusMiles,location:coordinates&&(place||area===areaName&&!address.trim())?{lng:coordinates[0],lat:coordinates[1]}:null})});
   const result=await response.json();if(!response.ok)throw new Error(result.error);
   setSaved(true);onSaved?.();setMessage(kind==="follow"?"Your interest in "+area.trim()+" is saved. This is a waitlist; project alerts are not active yet.":"Your coverage request for "+area.trim()+" is saved. Submitting a request does not start project alerts.");
  }catch(error){setMessage(error instanceof Error?error.message:"Please try again.");}finally{setSaving(false);}
 }}>
  {!saved&&<>
   <div className="grid gap-4 sm:grid-cols-2">
    {!place&&<div className="space-y-3"><label className="block text-sm">City or county<select required value={customArea?"other":area} onChange={e=>{const other=e.target.value==="other";setCustomArea(other);setArea(other?"":e.target.value);}} className={input}><option value="" disabled>Choose a city or county</option>{areas.map(a=><option key={a.id} value={a.label}>{a.label}</option>)}<option value="other">Another city or county</option></select></label>{customArea&&<label className="block text-sm">Enter a city or county<input required maxLength={160} value={area} onChange={e=>setArea(e.target.value)} autoComplete="address-level2" placeholder="City or county, state" className={input}/></label>}</div>}
    <label className="text-sm">Email <span className="text-zinc-500">{kind==="follow"?"(required)":"(optional)"}</span><input required={kind==="follow"} type="email" maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={input}/></label>
   </div>
   {!place&&<label className="block text-sm">Address, intersection, or neighborhood <span className="text-zinc-500">(optional)</span><input maxLength={300} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Narrow down the place you care about" aria-describedby={id+"-location-note"} className={input}/></label>}
   <p id={id+"-location-note"} className="text-xs leading-5 text-zinc-500">{place?"The selected pin and radius are saved with your submission. All current and future tracked jurisdictions intersecting that radius are included. Your location is not published.":"A nearby intersection or neighborhood is enough; you do not need to share your home address. This location is saved with your submission and is not published."}</p>
   <label className="block text-sm">What interests you? <span className="text-zinc-500">(optional)</span><textarea rows={2} maxLength={1000} value={interests} onChange={e=>setInterests(e.target.value)} placeholder="For example: new housing, commercial projects, or a particular development" className={input}/></label>
   <div hidden aria-hidden="true"><label>Website<input name="website" value={website} onChange={e=>setWebsite(e.target.value)} tabIndex={-1} autoComplete="off"/></label></div>
   <button disabled={saving} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{saving?"Saving…":kind==="follow"?"I'm interested":"Request coverage"}</button>
   <p className="text-xs leading-5 text-zinc-500">We save the area, optional location, interests, email, and submission date only when you submit. No alerts are sent yet. <Link href="/privacy" className="underline">Privacy</Link></p>
  </>}
  {message&&<p role="status" className="text-sm">{message}</p>}
 </form>;
}
