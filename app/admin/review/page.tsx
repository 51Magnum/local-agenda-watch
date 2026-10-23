import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { authorizedReviewer } from "@/lib/timeline/auth";
import { getEvidenceStore } from "@/lib/timeline/store";
import { FIELD_LABELS, evidenceSourceHref } from "@/lib/timeline/types";
import { needsDecisionApproval } from "@/lib/timeline/review";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review case evidence", robots: { index: false, follow: false } };
export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!authorizedReviewer((await headers()).get("authorization"))) return <main className="p-8">Review access requires the configured admin password.</main>;
  const query = await searchParams;
  let state;
  try { state = await getEvidenceStore().read(); }
  catch (error) {
    console.error("[timeline:review] Storage unavailable", error instanceof Error ? error.message : "Unknown error");
    return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Review storage unavailable</h1><p className="mt-4">Configure the Neon DATABASE_URL and verify database access before reviewing evidence.</p></main>;
  }
  const fields = Object.values(state.fields).filter((field) => state.documents[field.documentId]?.hash === field.documentHash && state.documents[field.documentId]?.state === "complete" && (query.all === "1" || field.status === "pending")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
    <h1 className="text-3xl font-semibold">Review case evidence</h1>
    <p>Decision fields and votes always need approval. Compare each value against its quoted source and physical PDF page. Edits and approvals are logged against that document version.</p>
    <nav className="flex gap-4 text-sm underline"><Link href="/admin/review">Pending review</Link><Link href="/admin/review?all=1">All current fields</Link></nav>
    {!process.env.OPENAI_API_KEY && <p role="status">Extraction is paused: OPENAI_API_KEY is not configured. Existing evidence can still be reviewed.</p>}
    {state.runs.slice(-1).map((run) => <details key={run.startedAt} className="rounded border p-4"><summary>Last check: {run.finishedAt ?? run.startedAt} — {run.processed} processed, {run.skipped} unchanged</summary><ul className="mt-3 space-y-2 text-sm">{run.errors.map((error, i) => <li key={i}>{error}</li>)}</ul></details>)}
    {Object.values(state.documents).filter((document) => document.validationWarnings?.length).map((document) => <details key={document.id} className="rounded border border-amber-400 p-4"><summary>Unsupported fields left empty: {document.title}</summary><ul className="mt-3 space-y-2 text-sm">{document.validationWarnings!.map((warning, i) => <li key={i}>{warning}</li>)}</ul><a href={document.url} className="mt-3 inline-block text-sm underline">Open original source</a></details>)}
    {!fields.length && <p>No {query.all === "1" ? "current" : "pending"} fields. New evidence appears after an ingestion run.</p>}
    {fields.map((field) => <article key={field.id} className="grid gap-6 rounded-xl border border-zinc-300 p-6 dark:border-zinc-700 md:grid-cols-2">
      <div className="space-y-3"><h2 className="text-xl font-semibold">{field.caseId} — {FIELD_LABELS[field.key]}</h2><p className="text-sm">{field.status} · confidence {Math.round(field.confidence * 100)}%{needsDecisionApproval(field) ? " · mandatory decision review" : ""}</p><p className="text-sm text-zinc-500">{state.documents[field.documentId].title}</p><blockquote className="whitespace-pre-wrap border-l-4 border-sky-500 pl-4 text-sm leading-7">{field.quote}</blockquote><a href={evidenceSourceHref(field)} target="_blank" rel="noopener noreferrer" className="text-sm underline">Open source{field.page ? " · PDF page " + field.page : " · city record"}</a></div>
      <form action="/admin/review/action" method="post" className="flex flex-col gap-3"><input type="hidden" name="id" value={field.id}/><label className="flex flex-col gap-2 text-sm">Extracted value<textarea name="value" defaultValue={field.value} rows={5} maxLength={4000} required className="rounded border border-zinc-400 bg-white p-3 text-black"/></label><label className="flex flex-col gap-2 text-sm">Review note<input name="note" maxLength={2000} className="rounded border border-zinc-400 bg-white p-3 text-black"/></label><div className="flex gap-3"><button name="action" value="approve" className="rounded bg-sky-700 px-4 py-2 text-white">Approve / save edit</button><button name="action" value="reject" formNoValidate className="rounded border border-red-500 px-4 py-2">Reject</button></div></form>
    </article>)}
    <details className="rounded border p-4"><summary>Review history ({state.audit.length})</summary><ul className="mt-3 space-y-2 text-sm">{state.audit.slice(-50).reverse().map((entry, i) => <li key={i}>{entry.at} · {entry.action} · {entry.fieldId.slice(0, 12)} · {entry.previousValue} → {entry.value}{entry.note && " · " + entry.note}</li>)}</ul></details>
  </main>;
}
