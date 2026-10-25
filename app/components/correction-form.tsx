"use client";
import {useState} from "react";
export default function CorrectionForm({project=""}:{project?:string}){
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 if(saved)return <p role="status">Thank you. Your correction report has been saved for review.</p>;
 return <form className="space-y-4 rounded-xl border p-5" onSubmit={async e=>{
  e.preventDefault();setBusy(true);setMessage("");const form=new FormData(e.currentTarget);
  try{const r=await fetch("/api/corrections",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(form))}),data=await r.json();if(!r.ok)throw Error(data.error);setSaved(true);}catch(error){setMessage(error instanceof Error?error.message:"Could not send.");}finally{setBusy(false);}
 }}><h2 className="text-xl font-semibold">Report an error</h2>
 <label className="block">Project<input className="mt-1 block w-full rounded border bg-transparent p-2" name="project" defaultValue={project} required maxLength={200}/></label>
 <label className="block">What’s wrong?<textarea className="mt-1 block w-full rounded border bg-transparent p-2" name="message" required minLength={5} maxLength={3000} rows={4}/></label>
 <label className="block">Email (optional)<input className="mt-1 block w-full rounded border bg-transparent p-2" name="email" type="email" maxLength={254}/></label>
 <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
 <p className="text-sm text-zinc-500">Please avoid residents’ personal details. We save your report and optional email for correction review.</p>
 <button disabled={busy} className="rounded border px-4 py-2">{busy?"Sending…":"Send report"}</button><p role="status">{message}</p></form>;
}
