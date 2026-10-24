import {displayArea,areaDate,areaTime} from "@/lib/areas/format";
import { type ProjectHearing } from "@/lib/projects";

export function ProjectNextStep({ hearing, calendarHref, emptyMessage, concise = false, areaId }: { hearing?: ProjectHearing; calendarHref: string; emptyMessage?: string; concise?: boolean; areaId?: string }) {
  const area=displayArea(areaId);const formatDate=(v:string)=>areaDate(v,area);const formatTime=(v:string)=>areaTime(v,area);
  return <section aria-labelledby="next-step-title" className="rounded-2xl border border-sky-300 bg-sky-50 p-6 dark:border-sky-700 dark:bg-sky-950/40">
    <h2 id="next-step-title" className="text-xl font-semibold">Next step</h2>
    {hearing ? <>
      <p className="mt-3 text-2xl font-semibold">{formatDate(hearing.startsAt)}</p>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Public hearing</dt><dd className="mt-1 font-medium">{hearing.startsAt.length > 10 ? formatTime(hearing.startsAt) + " ("+area.timezone+")" : "Time not confirmed"}</dd></div>
        <div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Decision-making body</dt><dd className="mt-1 font-medium">{hearing.body}</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm text-zinc-500 dark:text-zinc-400">Location</dt><dd className="mt-1">{hearing.location}</dd></div>
        <div className="sm:col-span-2 border-t border-sky-200 pt-4 dark:border-sky-800"><dt className="text-sm font-semibold">Written-comment deadline{area.type==="city"?" (portal)":""}</dt><dd className="mt-1">{hearing.commentDeadline ? formatDate(hearing.commentDeadline) + (hearing.commentDeadline.length>10 ? " at " + formatTime(hearing.commentDeadline) : " (time not specified)") : "Not confirmed. Check the official hearing notice."}</dd>
          {hearing.commentDeadline && !concise && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Based on {area.bodies.decision.label} meeting rules; confirm with the published agenda.</p>}
        </div>
      </dl>
      <p className="mt-5 text-sm leading-6">{area.meetingRules.commentInstructions}</p>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium">
        <a href={area.commentInstructionsUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">How to comment — official instructions</a>
        {hearing.startsAt.length > 10 && <a href={calendarHref} className="underline underline-offset-4">Add hearing to calendar (.ics)</a>}
        <a href={hearing.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Official hearing schedule</a>
      </div>
      {hearing.agendaUrl && <a href={hearing.agendaUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">View official agenda</a>}
      {hearing.packetUrl && <a href={hearing.packetUrl} target="_blank" rel="noopener noreferrer" className="ml-4 mt-4 inline-block text-sm font-medium underline underline-offset-4">View official meeting packet</a>}
      {!hearing.agendaUrl && <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{area.meetingRules.agendaNotice}</p>}
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{concise ? "Date and written-comment deadline: confirm with the published agenda; individual items may be heard later." : "Individual items may be heard after the public hearing start time. Dates and agendas can change."}</p>
    </> : <>
      <p className="mt-3 font-medium">{emptyMessage ?? "No hearing scheduled yet."}</p>
      <a href={area.commentInstructionsUrl} className="mt-3 inline-block text-sm underline underline-offset-4">How to participate when a hearing is scheduled</a>
    </>}
  </section>;
}
