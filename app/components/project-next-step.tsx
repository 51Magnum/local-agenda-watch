import { PENDING_AGENDA_MESSAGE } from "@/lib/case-details";
import { formatDenverDate, formatDenverTime, PUBLIC_COMMENT_URL, type ProjectHearing } from "@/lib/projects";

export function ProjectNextStep({ hearing, calendarHref, emptyMessage }: { hearing?: ProjectHearing; calendarHref: string; emptyMessage?: string }) {
  return <section aria-labelledby="next-step-title" className="rounded-2xl border border-sky-300 bg-sky-50 p-6 dark:border-sky-700 dark:bg-sky-950/40">
    <h2 id="next-step-title" className="text-xl font-semibold">Next step</h2>
    {hearing ? <>
      <p className="mt-3 text-2xl font-semibold">{formatDenverDate(hearing.startsAt)}</p>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Public hearing</dt><dd className="mt-1 font-medium">{hearing.startsAt.length > 10 ? formatDenverTime(hearing.startsAt) + " (America/Denver)" : "Time not confirmed"}</dd></div>
        <div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Decision-making body</dt><dd className="mt-1 font-medium">{hearing.body}</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm text-zinc-500 dark:text-zinc-400">Location</dt><dd className="mt-1">{hearing.location}</dd></div>
        <div className="sm:col-span-2 border-t border-sky-200 pt-4 dark:border-sky-800"><dt className="text-sm font-semibold">Written-comment deadline (portal)</dt><dd className="mt-1">{hearing.commentDeadline ? formatDenverDate(hearing.commentDeadline) + " at " + formatDenverTime(hearing.commentDeadline) : "Not confirmed. Check the city's instructions."}</dd>
          {hearing.commentDeadline && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Based on the city’s regular Council meeting rules; confirm with the published agenda.</p>}
        </div>
      </dl>
      <p className="mt-5 text-sm leading-6">Once the agenda is posted, use the comment bubble in the city’s meeting portal to send written comments, or the microphone button to sign up to speak. Include the relevant case number.</p>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium">
        <a href={PUBLIC_COMMENT_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">How to comment — official instructions</a>
        {hearing.startsAt.length > 10 && <a href={calendarHref} className="underline underline-offset-4">Add hearing to calendar (.ics)</a>}
        <a href={hearing.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Official hearing schedule</a>
      </div>
      {hearing.agendaUrl && <a href={hearing.agendaUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">View official agenda</a>}
      {hearing.packetUrl && <a href={hearing.packetUrl} target="_blank" rel="noopener noreferrer" className="ml-4 mt-4 inline-block text-sm font-medium underline underline-offset-4">View official meeting packet</a>}
      {!hearing.agendaUrl && <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{PENDING_AGENDA_MESSAGE}</p>}
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">Individual items may be heard after the public hearing start time. Dates and agendas can change.</p>
    </> : <>
      <p className="mt-3 font-medium">{emptyMessage ?? "No hearing scheduled yet."}</p>
      <a href={PUBLIC_COMMENT_URL} className="mt-3 inline-block text-sm underline underline-offset-4">How to participate when a hearing is scheduled</a>
    </>}
  </section>;
}
