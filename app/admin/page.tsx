import {headers} from "next/headers";
import {authorizedReviewer} from "@/lib/timeline/auth";
import {readSchedule} from "@/lib/timeline/schedule-store";
import {timelineHealth} from "@/lib/timeline/health";
import {AREAS} from "@/lib/areas/registry";
export const dynamic="force-dynamic";
export default async function Admin(){
 if(!authorizedReviewer((await headers()).get("authorization")))return <main>Admin access required.</main>;
 let schedule;try{schedule=await readSchedule();}catch{return <main className="p-8">Schedule health storage unavailable.</main>;}
 const warnings=timelineHealth(schedule,AREAS);
 return <main className="mx-auto max-w-6xl space-y-6 p-8"><h1 className="text-3xl font-semibold">Site health</h1><nav className="flex flex-wrap gap-5 underline"><a href="/admin/review">Evidence review</a><a href="/admin/images">Image review</a><a href="/admin/corrections">Correction reports</a><a href="/admin/privacy">Residential privacy</a><a href="/admin/signups">Signups</a></nav>{warnings.length>0?<section role="alert" className="rounded border-2 border-amber-500 p-4"><h2 className="text-xl font-semibold">Source follow-up needed</h2><ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul><p className="mt-3 text-sm">No mail delivery helper is configured. These alerts are logged and shown here.</p></section>:<p>Source sweep and hearing-result checks are current.</p>}<h2 className="text-xl font-semibold">Last successful source sweep</h2><table className="w-full text-left"><thead><tr><th>Area</th><th>Last success</th><th>Last attempt</th><th>Cases / documents</th></tr></thead><tbody>{Object.values(AREAS).filter(a=>a.status==="live"&&a.timeline).map(a=>{const s=schedule.sweeps?.[a.id];return <tr key={a.id}><td className="py-2">{a.name}</td><td>{s?.lastSuccessAt??"Not recorded"}</td><td>{s?.lastAttemptAt??"Not recorded"}{s?.warning&&<p>{s.warning}</p>}</td><td>{s?`${s.cases} / ${s.documents}`:"—"}</td></tr>;})}</tbody></table><p className="text-sm">A source sweep checks case feeds and discovers documents. Extraction continues within the run budget; a successful sweep does not mean every document has been extracted.</p></main>;
}
