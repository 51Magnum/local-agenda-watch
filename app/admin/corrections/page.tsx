import Link from "next/link";
import {headers} from "next/headers";
import {authorizedReviewer} from "@/lib/timeline/auth";
import {readCorrections} from "@/lib/corrections";
export const dynamic="force-dynamic";
export default async function CorrectionsAdmin(){
 if(!authorizedReviewer((await headers()).get("authorization")))return <main>Admin access required.</main>;
 let rows;try{rows=await readCorrections();}catch{return <main className="p-8">Correction storage unavailable.</main>;}
 return <main className="mx-auto max-w-5xl space-y-5 p-8"><Link href="/admin" className="underline">Admin overview</Link><h1 className="text-3xl font-semibold">Correction reports</h1>{!rows.length&&<p>No reports received.</p>}{rows.map(row=><article key={row.id} className="space-y-2 rounded border p-4"><h2 className="font-semibold">{row.project}</h2><p className="whitespace-pre-wrap">{row.message}</p><p>{row.email??"No reply email"} · {new Date(row.created_at).toISOString()} · {row.status}</p><form method="post" action="/admin/corrections/action"><input type="hidden" name="id" value={row.id}/><button className="rounded border px-3 py-1" name="status" value={row.status==="resolved"?"new":"resolved"}>{row.status==="resolved"?"Reopen":"Mark resolved"}</button></form></article>)}</main>;
}
