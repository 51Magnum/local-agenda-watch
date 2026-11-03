"use client";
import {useState} from "react";
export default function SignInForm({next}:{next:string}){
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 return <form className="mt-6 space-y-4" onSubmit={async event=>{event.preventDefault();setBusy(true);setMessage("");const form=new FormData(event.currentTarget);try{const response=await fetch("/api/auth/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:form.get("email"),website:form.get("website"),next})}),data=await response.json();setMessage(data.message??data.error??"Please try again later.");}catch{setMessage("Sign-in email is temporarily unavailable. Please try again later.");}finally{setBusy(false);}}}>
  <label className="block">Email address<input className="mt-2 block w-full rounded border p-3" type="email" name="email" autoComplete="email" maxLength={254} required/></label>
  <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  <button className="min-h-11 rounded bg-teal-700 px-5 py-3 text-white disabled:opacity-60" disabled={busy}>{busy?"Sending…":"Email me a sign-in link"}</button>
  <p role="status" className="text-sm">{message}</p>
 </form>;
}
