"use client";
import Link from "next/link";
import {useState} from "react";
import {adminResidentTime,type AdminResidentSearch} from "@/lib/admin-resident-types";
export default function ResidentSearch({initial}:{initial:AdminResidentSearch}){
 const [result,setResult]=useState(initial),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 return <section className="space-y-4"><form className="flex flex-wrap items-end gap-4" method="post" action="/admin/residents/search" onSubmit={async e=>{
  e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);setMessage("");
  try{const response=await fetch("/admin/residents/search",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({email:data.get("email"),mode:data.get("mode")})});if(!response.ok)throw Error("Search is unavailable. Check admin access and try again.");setResult(await response.json());}
  catch{setMessage("Search is unavailable. Check admin access and try again.");}finally{setBusy(false);}
 }}><label>Email or part of an email<input className="mt-1 block rounded border p-2" name="email" type="text" maxLength={254} autoComplete="off" spellCheck={false}/></label><label>Match<select className="mt-1 block rounded border p-2" name="mode"><option value="partial">Contains</option><option value="exact">Exact email</option></select></label><button className="rounded border px-4 py-2" disabled={busy}>{busy?"Searching…":"Search accounts"}</button></form>
  {message&&<p role="alert">{message}</p>}{result.hasMore&&<p>Showing the first 50 accounts. Refine your search to find more.</p>}
  <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Resident accounts</caption><thead><tr><th>Email</th><th>Plan</th><th>Active pins</th><th>Inactive pins</th><th>Signed up</th><th>Last sign-in</th></tr></thead><tbody>{result.residents.map(r=><tr key={r.id}><td className="py-3 pr-4"><Link className="underline" href={"/admin/residents/"+r.id}>{r.email}</Link></td><td>{r.plan==="paid"?"Paid":"Free"}</td><td>{r.activePins}</td><td>{r.inactivePins}</td><td className="px-3">{adminResidentTime(r.createdAt)}</td><td>{adminResidentTime(r.lastSignInAt)}</td></tr>)}</tbody></table></div>
  {!result.residents.length&&<p>No matching accounts.</p>}<p className="text-sm">Search is private. Email searches are submitted in a request body, never in the URL. Pin locations are not shown.</p>
 </section>;
}
