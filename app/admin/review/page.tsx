import {tokenTotals} from "@/lib/timeline/compact";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { authorizedReviewer } from "@/lib/timeline/auth";
import { getEvidenceStore } from "@/lib/timeline/store";
import { FIELD_LABELS } from "@/lib/timeline/types";
import { accuracyStats } from "@/lib/timeline/review";
import { reconcileFields, verifyCandidate } from "@/lib/timeline/verification";
import { DECISION_KEYS } from "@/lib/timeline/types";
import { ReviewQueue } from "./queue";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review case evidence", robots: { index: false, follow: false } };
export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!authorizedReviewer((await headers()).get("authorization"))) return <main className="p-8">Review access requires the configured admin password.</main>;
  await searchParams;
  const store=getEvidenceStore();
  let state: import("@/lib/timeline/types").EvidenceState;
  try { state = await store.read();
    // Idempotent legacy verification: load only pages needed for existing decision rows.
    const needs=Object.values(state.fields).filter(f=>DECISION_KEYS.has(f.key)&&!f.verification&&state.documents[f.documentId]?.state==="complete"&&state.documents[f.documentId]?.hash===f.documentHash);
    const pages=new Map<string,import("@/lib/timeline/types").PageText[]>();
    for(const id of new Set(needs.map(f=>f.documentId)))pages.set(id,store.pages?await store.pages(id):state.documents[id].pages);
    const prepared=structuredClone(state);const changed=reconcileFields(prepared);
    if(changed||needs.length){await store.mutate(current=>{
      reconcileFields(current);
      for(const f of Object.values(current.fields))if(DECISION_KEYS.has(f.key)&&!f.verification&&pages.has(f.documentId))f.verification=verifyCandidate(f,current.documents[f.documentId],pages.get(f.documentId)!);
    });state=await store.read();} }
  catch (error) {
    console.error("[timeline:review] Storage unavailable", error instanceof Error ? error.message : "Unknown error");
    return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Review storage unavailable</h1><p className="mt-4">Configure the Neon DATABASE_URL and verify database access before reviewing evidence.</p></main>;
  }
  const fields = Object.values(state.fields).filter(f=>state.documents[f.documentId]?.hash===f.documentHash&&state.documents[f.documentId]?.state==="complete").map(f=>({...f,documentTitle:state.documents[f.documentId].title,meetingDate:state.documents[f.documentId].meeting?.date}));
  const stats=accuracyStats(state);
  return <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
    <h1 className="text-3xl font-semibold">Review case evidence</h1>
    <p>Final decisions and vote tallies always need approval. Verified speaker counts and conditions can publish automatically. Review means confirming our summary, not approving a development.</p>
    <nav className="flex gap-4 text-sm underline"><Link href="/admin/images">Image privacy review</Link><Link href="/admin/signups">Signups &amp; coverage requests</Link></nav>
    {!process.env.OPENAI_API_KEY && <p role="status">Extraction is paused: OPENAI_API_KEY is not configured. Existing evidence can still be reviewed.</p>}
    {state.runs.slice(-1).map((run) => <details key={run.startedAt} className="rounded border p-4"><summary>Last check: {run.finishedAt ?? run.startedAt} — {run.processed} processed, {run.skipped} unchanged</summary><p className="mt-3 text-sm">{tokenTotals(run).calls} AI calls · {tokenTotals(run).total} tokens</p>{Object.entries(run.areas??{}).map(([area,c])=><p key={area} className="text-sm">{area}: {c.cases} cases, {c.visited} visited, {c.documents} documents, {c.extracted} extracted</p>)}{run.hosts?.map((h,i)=><p key={i} className="text-sm">{h.areaId} · {h.host}: {h.outcome}</p>)}<ul className="mt-3 space-y-2 text-sm">{run.errors.map((error, i) => <li key={i}>{error}</li>)}</ul></details>)}
    {Object.values(state.documents).filter(d=>d.state==="failed-permanent").map(d=><article key={d.id} className="rounded border border-red-500 p-4"><h2 className="font-semibold">Stopped after three failures: {d.title}</h2><p className="text-sm">{d.areaId??"nampa"} · Last attempt {d.lastAttemptAt}</p><p className="text-sm">{d.error}</p><a href={d.url} className="underline">Source</a><form action="/admin/review/action" method="post"><input type="hidden" name="id" value={d.id}/><button name="action" value="retry" className="mt-3 rounded border px-4 py-2">Retry</button></form></article>)}
    {Object.values(state.documents).filter((document) => document.validationWarnings?.length).map((document) => <details key={document.id} className="rounded border border-amber-400 p-4"><summary>Unsupported fields left empty: {document.title}</summary><ul className="mt-3 space-y-2 text-sm">{document.validationWarnings!.map((warning, i) => <li key={i}>{warning}</li>)}</ul><a href={document.url} className="mt-3 inline-block text-sm underline">Open original source</a></details>)}
    <details className="rounded border p-4"><summary>Accuracy by field type</summary><p className="my-2 text-sm">Unedited approvals / all human reviews. Edits and rejections count as corrections; undone reviews are excluded. This measures reviewer agreement, not independently measured truth.</p>{stats.map(s=><p key={s.key} className="text-sm">{FIELD_LABELS[s.key as keyof typeof FIELD_LABELS]}: {s.correct}/{s.reviews} unchanged ({Math.round(s.accuracy*100)}%){s.suggest?" — Suggestion: eligible for considering automatic approval; final decision policy remains manual.":""}</p>)}</details>
    <ReviewQueue initialFields={fields}/>
    <details className="rounded border p-4"><summary>Review history ({state.audit.length})</summary><ul className="mt-3 space-y-2 text-sm">{state.audit.slice(-50).reverse().map((entry, i) => <li key={i}>{entry.at} · {entry.action} · {entry.fieldId.slice(0, 12)} · {entry.previousValue} → {entry.value}{entry.note && " · " + entry.note}</li>)}</ul></details>
  </main>;
}
