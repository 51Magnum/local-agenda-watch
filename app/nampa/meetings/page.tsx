import type { Metadata } from "next";
import Link from "next/link";
import { getNampaMeetingArchive } from "@/lib/sources/primegov";
import { getLocalityContext, localityHref } from "@/lib/locality";
import { SITE_ORIGIN } from "@/lib/site-config";

export const metadata: Metadata = { title: "Nampa past meetings, agendas & results", alternates: { canonical: SITE_ORIGIN + "/nampa/meetings" } };

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const caseId = typeof query.case === "string" && /^[A-Z]{2,6}-\d{5}-\d{4}$/.test(query.case) ? query.case : undefined;
  const currentYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", year: "numeric" }).format(new Date()));
  const candidateYear = Number(query.year ?? caseId?.slice(-4) ?? currentYear);
  const year = Number.isInteger(candidateYear) && candidateYear >= 2023 && candidateYear <= currentYear ? candidateYear : currentYear;
  const body = typeof query.body === "string" && ["P&Z", "City Council", "Arts & Historic Preservation"].includes(query.body) ? query.body : undefined;
  const ctx = await getLocalityContext();
  const href = (path: string) => localityHref("nampa", path, ctx);
  const { meetings, unavailable, unsearched } = await getNampaMeetingArchive(year, { caseId, body });
  return <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
    <Link href={href("")} className="text-sm underline">← Nampa</Link>
    <header className="space-y-3">
      <h1 className="text-3xl font-semibold">Past meetings, agendas &amp; results</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{caseId ? "Meetings with an agenda item referencing " + caseId + "." : "City Council, Planning & Zoning, and Arts & Historic Preservation meeting records."} {body && body + "."}</p>
      <p className="text-sm leading-6 text-zinc-500">Read the official minutes for motions and votes. An agenda or staff recommendation does not establish the outcome. A P&amp;Z recommendation is separate from a Council decision.</p>
    </header>
    <form className="flex flex-wrap items-end gap-4">
      {caseId && <input type="hidden" name="case" value={caseId} />}
      <label className="flex flex-col gap-1 text-sm">Year<select name="year" defaultValue={year} className="rounded border border-zinc-400 bg-white p-2 text-black">{Array.from({ length: currentYear - 2022 }, (_, i) => currentYear - i).map((y) => <option key={y}>{y}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Meeting body<select name="body" defaultValue={body ?? ""} className="rounded border border-zinc-400 bg-white p-2 text-black"><option value="">All bodies</option>{["City Council", "P&Z", "Arts & Historic Preservation"].map((b) => <option key={b}>{b}</option>)}</select></label>
      <button className="rounded border border-zinc-400 px-4 py-2 text-sm">Show meetings</button>
      {caseId && <Link href={href("/meetings?year=" + year)} className="text-sm underline">Browse all meetings for this year</Link>}
    </form>
    {unavailable && <p role="status">Meeting archive temporarily unavailable. <a href="https://nampa.primegov.com/public/portal" className="underline">Open the official archive</a>.</p>}
    {!!unsearched && <p className="text-sm text-zinc-500">{unsearched} meeting agendas could not be searched, including PDF-only or unavailable agendas. This case history may be incomplete. <Link href={href("/meetings?year=" + year)} className="underline">Browse all meetings</Link>.</p>}
    {!unavailable && !meetings.length && <p>No matching past meeting found for {year}. This does not establish that a hearing has not occurred. Check other years or the official archive.</p>}
    <div className="space-y-6">{meetings.map((meeting) => <article key={meeting.id} className="space-y-4 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-xl font-semibold">{meeting.dateLabel} — {meeting.title}</h2>
      <p className="text-sm text-zinc-500">{meeting.timeLabel && meeting.timeLabel + " · America/Denver"}{meeting.location && " · " + meeting.location}</p>
      <div className="flex flex-wrap gap-4 text-sm underline underline-offset-4">
        {meeting.agendaUrl && <a href={meeting.agendaUrl}>Official agenda</a>}
        {meeting.packetUrl && <a href={meeting.packetUrl}>Meeting packet</a>}
        {meeting.minutesUrl && <a href={meeting.minutesUrl}>Minutes — motions &amp; votes</a>}
        {meeting.videoUrl && <a href={meeting.videoUrl}>Meeting recording</a>}
      </div>
      {!meeting.minutesUrl && <p className="text-sm text-zinc-500">Result not yet available here: no minutes link is published in this meeting’s archive entry.{meeting.videoUrl ? " A recording is available." : " Check the official portal for updates."}</p>}
      {!meeting.agendaUrl && <p className="text-sm text-zinc-500">No agenda link published in the archive entry.</p>}
      {meeting.items.map((item) => <div key={item.agendaUrl} className="space-y-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800"><p>{item.title}</p><a href={item.agendaUrl} className="underline">Open this agenda item</a>{item.staffReports.map((report) => <p key={report.url}><a href={report.url} className="underline">{report.label}</a></p>)}</div>)}
    </article>)}</div>
    <p className="text-sm text-zinc-500">Source: <a href="https://nampa.primegov.com/public/portal" className="underline">City of Nampa public meetings portal</a>. Records refresh hourly. Some older records may be in the city’s <a href="https://www.cityofnampa.us/AgendaCenter" className="underline">Agenda Center</a>.</p>
  </main>;
}
