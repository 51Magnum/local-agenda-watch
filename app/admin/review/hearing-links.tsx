import { listHearingMatches, effectiveHearingFields } from "@/lib/hearings/store";
import { HEARING_OVERRIDE_FIELDS } from "@/lib/hearings/overrides";
import { projectDetail } from "@/lib/maps/project-detail";
import { hearingKey } from "@/lib/hearings/types";
import { AREAS } from "@/lib/areas/registry";
import Link from "next/link";
export default async function HearingLinksReview({areaId,caseId}:{areaId?:string;caseId?:string}) {
  const rows=await listHearingMatches();
  let selected;
  if(areaId&&AREAS[areaId]&&caseId&&/^[A-Z0-9-]{2,80}$/.test(caseId))selected=await projectDetail(areaId,caseId);
  if(selected?.next){
    const key=hearingKey({body:selected.next.body,startsAt:selected.next.startsAt,timezone:selected.area.timezone});
    if(!rows.some(r=>r.areaId===areaId&&r.caseId===caseId&&r.hearingKey===key))rows.unshift({areaId:areaId!,caseId:caseId!,hearingKey:key,data:selected.next,override:{},failureCount:0});
  }
  return <section className="space-y-4 rounded border p-5"><h2 className="text-2xl font-semibold">Upcoming hearing meeting links</h2>
    <p>Automatic matches use the exact hearing date, body and case numbers. A saved override survives future sweeps. Empty manual fields remove that link; “Use automatic match” clears the override. Retry resets the three-failure cap.</p>
    <Link className="underline" href="/admin/review?hearing_area=nampa&hearing_case=ANN-00371-2026">Review Braeburn Creek meeting links</Link>
    <form method="get" className="flex flex-wrap gap-3"><label>Area <select name="hearing_area" defaultValue={areaId??"nampa"} className="min-h-11 border p-2">{Object.values(AREAS).filter(a=>a.status==="live").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Case number <input name="hearing_case" defaultValue={caseId} required className="min-h-11 border p-2"/></label><button className="min-h-11 rounded border px-4">Load hearing</button></form>
    {!rows.length&&<p>No matches recorded yet. The existing sweep polls upcoming hearings; a missing agenda is not a failure.</p>}
    {rows.map(row=>{const fields=effectiveHearingFields(row);return <details key={[row.areaId,row.caseId,row.hearingKey].join("/")} open={row.areaId===areaId&&row.caseId===caseId} className="rounded border p-4">
      <summary className="min-h-11 cursor-pointer">{row.areaId} · {row.caseId} · {row.hearingKey} · {fields.match_status??"Not checked yet"}{Object.keys(row.override).length?" · Manual override":""}</summary>
      <p>Matched body: {fields.meeting_body??"—"} · Hearing time: {fields.meeting_datetime??"—"}</p><p>Last successful link check: {fields.last_checked_at??"Not checked yet"} · Last attempt: {row.lastAttemptAt??"—"} · Failures: {row.failureCount}/3</p>
      {row.lastError&&<p role="status">{row.lastError}</p>}
      <form method="post" action="/admin/review/hearing-action" className="grid gap-3">
        <input type="hidden" name="area" value={row.areaId}/><input type="hidden" name="case" value={row.caseId}/><input type="hidden" name="hearing" value={row.hearingKey}/>
        {HEARING_OVERRIDE_FIELDS.map(field=><label key={field} className="grid gap-1">{field.replaceAll("_"," ")}<input name={field} defaultValue={String(fields[field]??"")} className="min-h-11 w-full rounded border p-2" type={field.endsWith("_url")?"url":"text"}/></label>)}
        <div className="flex flex-wrap gap-3"><button name="mode" value="manual" className="min-h-11 rounded bg-teal-700 px-4 text-white">Save manual override</button><button name="mode" value="automatic" className="min-h-11 rounded border px-4">Use automatic match / retry</button></div>
      </form>
    </details>;})}
  </section>;
}
