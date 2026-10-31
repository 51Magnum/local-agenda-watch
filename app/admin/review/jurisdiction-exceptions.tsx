import {exceptionQueue,publicationAlerts} from "@/lib/jurisdictions/self-check-store";
import {ingestionJurisdictions} from "@/lib/jurisdictions/registry";
export default async function JurisdictionExceptions(){
 let rows:Awaited<ReturnType<typeof exceptionQueue>>=[],alerts:Awaited<ReturnType<typeof publicationAlerts>>=[];try{[rows,alerts]=await Promise.all([exceptionQueue(),publicationAlerts()]);}catch{return <section><h2>Jurisdiction exceptions</h2><p>Exception storage is unavailable. Verify the preview database and migrations.</p></section>;}
 return <section className="space-y-4"><h2 className="text-2xl font-semibold">Jurisdiction exceptions</h2>
 {alerts.map(a=><p role="alert" key={a.area_id}>{a.area_id}: {a.status}. {(a.report.passRate*100).toFixed(2)}% pass. {a.report.decision}</p>)}
 {ingestionJurisdictions().filter(d=>!d.legacyPublic).map(d=><form key={d.id} action="/admin/review/jurisdiction-action" method="post"><input type="hidden" name="areaId" value={d.id}/><button className="rounded border px-4 py-2" name="action" value="pause">Pause {d.name}</button></form>)}
 {!rows.length&&<p>No pending record exceptions.</p>}
 {rows.map(row=><article className="rounded border p-4" key={row.area_id+row.record_id+row.source_hash}><h3>{row.area_id} · {row.record_id}</h3>{row.data.map((q,i)=><p key={i}>{q.check.check}: {q.check.reason} <a className="underline" href={q.check.sourceUrl}>Official source</a>{q.proposal&&<span> AI proposal: {q.proposal.title??"Hide documents"} · {q.proposal.reason}</span>}</p>)}<form className="flex gap-4" action="/admin/review/jurisdiction-action" method="post"><input type="hidden" name="areaId" value={row.area_id}/><input type="hidden" name="recordId" value={row.record_id}/><input type="hidden" name="sourceHash" value={row.source_hash}/><button name="action" value="approve">Approve as is</button><button name="action" value="fix" disabled={!row.data.some(q=>q.proposal)}>Apply fix</button><button name="action" value="hide">Hide</button></form></article>)}
 </section>;
}
