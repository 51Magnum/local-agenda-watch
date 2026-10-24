"use client";
import { useEffect, useRef, useState } from "react";
import { FIELD_LABELS, evidenceSourceHref, type EvidenceField } from "@/lib/timeline/types";
import { fieldLabel, passing, queueReasons, riskScore } from "@/lib/timeline/verification";
export type QueueField=EvidenceField & {documentTitle:string;meetingDate?:string};
export function ReviewQueue({initialFields}:{initialFields:QueueField[]}){
 const [page,setPage]=useState(0);
 const [fields,setFields]=useState(initialFields),[tab,setTab]=useState<"pending"|"done">("pending"),[filter,setFilter]=useState("");
 const [selected,setSelected]=useState<Set<string>>(new Set()),[drafts,setDrafts]=useState<Record<string,string>>({}),[notes,setNotes]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[fading,setFading]=useState<Set<string>>(new Set()),[error,setError]=useState(""),[focused,setFocused]=useState("");
 const [toasts,setToasts]=useState<{id:string;expires:number;count:number}[]>([]);
 const cards=useRef(new Map<string,HTMLElement>());
 const filtered=fields.filter(f=>(tab==="pending"?f.status==="pending":f.status!=="pending")&&(!filter||[f.caseId,f.body,f.documentTitle,FIELD_LABELS[f.key]].join(" ").toLowerCase().includes(filter.toLowerCase()))).sort((a,b)=>riskScore(b)-riskScore(a)||a.caseId.localeCompare(b.caseId));
 const pages=Math.max(1,Math.ceil(filtered.length/100)),currentPage=Math.min(page,pages-1);
 const visible=filtered.slice(currentPage*100,(currentPage+1)*100);
 const groups=new Map<string,QueueField[]>();for(const f of visible){const key=[f.areaId??"nampa",f.caseId,f.body,f.meetingDate??""].join(" | ");groups.set(key,[...(groups.get(key)??[]),f]);}
 const ordered=[...groups.values()].flat();
 function focusCard(id:string,scroll=false){setFocused(id);cards.current.get(id)?.focus({preventScroll:true});if(scroll)cards.current.get(id)?.scrollIntoView({block:"nearest"});}
 function toggle(id:string){setSelected(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;});}
 async function submit(ids:string[],action:"approve"|"reject",onlyPassing=false){
  if(busy||!ids.length)return;setBusy(true);setError("");
  const scroll={x:window.scrollX,y:window.scrollY};
  const index=ordered.findIndex(f=>ids.includes(f.id));const next=ordered.slice(index+1).find(f=>!ids.includes(f.id))??ordered.find(f=>!ids.includes(f.id));
  try{
   const items=ids.map(id=>{const f=fields.find(f=>f.id===id)!;return {id,action,value:drafts[id]??f.value,note:notes[id]??"",expectedReviewedAt:f.reviewedAt??"",expectedValue:f.value};});
   const response=await fetch("/admin/review/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items,onlyPassing})});const result=await response.json();if(!response.ok)throw new Error(result.error);
   setFading(new Set(ids));await new Promise(r=>setTimeout(r,180));
   setFields(prev=>prev.map(f=>{const updated=result.fields.find((v:EvidenceField)=>v.id===f.id);return updated?{...f,...updated}:f;}));
   setSelected(prev=>new Set([...prev].filter(id=>!ids.includes(id))));setFading(new Set());
   setToasts(prev=>[...prev,{id:result.batchId,expires:Date.now()+10000,count:ids.length}]);
   requestAnimationFrame(()=>{window.scrollTo({left:scroll.x,top:scroll.y,behavior:"instant"});if(next)focusCard(next.id);});
  }catch(e){setError(e instanceof Error?e.message:"Review failed");}finally{setBusy(false);}
 }
 async function undo(id:string){if(busy)return;setBusy(true);setError("");try{const r=await fetch("/admin/review/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"undo",batchId:id})});const data=await r.json();if(!r.ok)throw new Error(data.error);setFields(prev=>prev.map(f=>({...f,...data.fields.find((v:EvidenceField)=>v.id===f.id)})));setToasts(prev=>prev.filter(t=>t.id!==id));}catch(e){setError(e instanceof Error?e.message:"Undo failed");}finally{setBusy(false);}}
 useEffect(()=>{if(!toasts.length)return;const timer=setTimeout(()=>setToasts(prev=>prev.filter(t=>t.expires>Date.now())),Math.max(1,Math.min(...toasts.map(t=>t.expires))-Date.now()));return()=>clearTimeout(timer);},[toasts]);
 useEffect(()=>{function key(e:KeyboardEvent){if(e.altKey||e.ctrlKey||e.metaKey||e.target instanceof HTMLElement&&e.target.closest("input,textarea,select,button,a,[contenteditable=true]"))return;const index=ordered.findIndex(f=>f.id===focused),f=ordered[index];switch(e.key.toLowerCase()){case "j":e.preventDefault();if(ordered.length)focusCard(ordered[Math.min(ordered.length-1,index+1)].id,true);break;case "k":e.preventDefault();if(ordered.length)focusCard(ordered[Math.max(0,index-1)].id,true);break;case "x":if(f){e.preventDefault();toggle(f.id);}break;case "a":if(f&&tab==="pending"){e.preventDefault();void submit([f.id],"approve");}break;case "r":if(f&&tab==="pending"){e.preventDefault();void submit([f.id],"reject");}}}window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);});
 const counts={pending:fields.filter(f=>f.status==="pending").length,approved:fields.filter(f=>["approved","auto_published"].includes(f.status)).length,rejected:fields.filter(f=>f.status==="rejected").length};
 const passingIds=visible.filter(f=>passing(f)&&(drafts[f.id]??f.value)===f.value).map(f=>f.id);
 const selectedIds=visible.filter(f=>selected.has(f.id)).map(f=>f.id);
 const button="rounded border px-3 py-2 text-sm disabled:opacity-40";
 return <section aria-label="Evidence review queue" style={{overflowAnchor:"none"}}>
  <div className="sticky top-0 z-30 space-y-3 rounded-xl border bg-[var(--background)] p-4 shadow-lg" style={{background:"var(--background, #fff)"}}>
   <div className="flex flex-wrap items-center gap-3"><button className={button} aria-pressed={tab==="pending"} onClick={()=>{setTab("pending");setPage(0);setSelected(new Set());}}>Pending ({counts.pending})</button><button className={button} aria-pressed={tab==="done"} onClick={()=>{setTab("done");setPage(0);setSelected(new Set());}}>Done · Approved {counts.approved} · Rejected {counts.rejected}</button><input aria-label="Filter queue" placeholder="Filter by case or body" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}} className="min-w-0 rounded border p-2"/><span className="text-xs">A approve · R reject · J/K move · X select</span></div>
   {tab==="pending"&&<div className="flex flex-wrap items-center gap-3"><label className="text-sm"><input type="checkbox" checked={visible.length>0&&visible.every(f=>selected.has(f.id))} onChange={e=>setSelected(e.target.checked?new Set(visible.map(f=>f.id)):new Set())}/> Select all on page</label><button className={button} onClick={()=>setSelected(new Set(passingIds))}>Select all passing checks</button><button className={button} disabled={busy||!passingIds.length} onClick={()=>void submit(passingIds,"approve",true)}>Approve all passing ({passingIds.length})</button><strong className="text-sm" aria-live="polite">{selectedIds.length} selected</strong><button className={button} disabled={busy||!selectedIds.length} onClick={()=>void submit(selectedIds,"approve")}>Approve selected</button><button className={button} disabled={busy||!selectedIds.length} onClick={()=>void submit(selectedIds,"reject")}>Reject selected</button><button className={button} onClick={()=>setSelected(new Set())}>Clear</button></div>}
   {pages>1&&<div className="flex items-center gap-3 text-sm"><button className={button} disabled={currentPage===0||busy} onClick={()=>setPage(currentPage-1)}>Previous page</button><span>Page {currentPage+1} of {pages} · 100 fields per page</span><button className={button} disabled={currentPage===pages-1||busy} onClick={()=>setPage(currentPage+1)}>Next page</button></div>}
   {error&&<p role="alert" className="text-red-600">{error}</p>}
  </div>
  {!visible.length&&<p className="py-8" role="status">No {tab==="pending"?"pending":"completed"} fields match.</p>}
  {[...groups].map(([key,group])=><section key={key} className="mt-8 space-y-4" aria-label={key}>
   <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{group[0].caseId} · {group[0].body??"Body unverified"}{group[0].meetingDate&&" · "+new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(group[0].meetingDate.slice(0,10)+"T12:00:00Z"))}<span className="ml-2 text-xs font-normal">{group[0].areaId??"nampa"}</span></h2>{tab==="pending"&&<button className={button} disabled={busy} onClick={()=>void submit(group.map(f=>f.id),"approve")}>Approve all for this case ({group.length})</button>}</header>
   {group.map(f=><article key={f.id} ref={el=>{if(el)cards.current.set(f.id,el);else cards.current.delete(f.id);}} tabIndex={0} data-field-id={f.id} onFocus={()=>setFocused(f.id)} className="grid gap-6 rounded-xl border p-6 outline-offset-4 transition-opacity duration-150 focus:outline-2 focus:outline-sky-600 md:grid-cols-2" style={{opacity:fading.has(f.id)?0:1}}>
    <div className="space-y-3"><h3 className="text-lg font-semibold">{tab==="pending"&&<input aria-label={"Select "+fieldLabel(f,FIELD_LABELS[f.key])} type="checkbox" checked={selected.has(f.id)} onChange={()=>toggle(f.id)} className="mr-3"/>}{fieldLabel(f,FIELD_LABELS[f.key])}</h3><p className="text-sm">{f.status} · {Math.round(f.confidence*100)}% confidence</p><ul className="text-sm">{queueReasons(f).map(reason=><li key={reason}>Review: {reason}</li>)}{(drafts[f.id]??f.value)!==f.value?<li>Edited value needs manual review</li>:passing(f)&&<li>All verification checks passed</li>}</ul><p className="text-sm text-zinc-500">{f.documentTitle}</p><blockquote className="whitespace-pre-wrap border-l-4 border-sky-500 pl-4 text-sm leading-7">{f.quote}</blockquote>{f.verification?.speakers?.length?<details><summary>Speaker evidence ({f.verification.speakers.length})</summary>{f.verification.speakers.map((s,i)=><p className="text-sm" key={i}>{s.name} · {s.position} · p. {s.page}: “{s.quote}”</p>)}</details>:null}<a href={evidenceSourceHref(f)} target="_blank" rel="noopener noreferrer" className="text-sm underline">Open source{f.page?" · PDF page "+f.page:" · city record"}</a></div>
    <div className="flex flex-col gap-3"><label className="flex flex-col gap-2 text-sm">Extracted value<textarea value={drafts[f.id]??f.value} onChange={e=>setDrafts(prev=>({...prev,[f.id]:e.target.value}))} rows={5} maxLength={4000} disabled={tab==="done"||busy} className="rounded border bg-white p-3 text-black"/></label>{tab==="pending"&&<><label className="flex flex-col gap-2 text-sm">Review note<input value={notes[f.id]??""} onChange={e=>setNotes(prev=>({...prev,[f.id]:e.target.value}))} maxLength={2000} className="rounded border bg-white p-3 text-black"/></label><div className="flex gap-3"><button disabled={busy} onClick={()=>void submit([f.id],"approve")} className="rounded bg-sky-700 px-4 py-2 text-white disabled:opacity-40">Approve / save edit</button><button disabled={busy} onClick={()=>void submit([f.id],"reject")} className={button}>Reject</button></div></>}</div>
   </article>)}
  </section>)}
  <div className="fixed bottom-5 right-5 z-50 space-y-2" aria-live="polite">{toasts.map(t=><div key={t.id} role="status" className="flex gap-5 rounded-lg bg-zinc-900 p-4 text-white shadow-xl">{t.count} field{t.count===1?"":"s"} handled<button className="underline" disabled={busy} onClick={()=>void undo(t.id)}>Undo</button><span className="text-xs">10 seconds</span></div>)}</div>
 </section>;
}
