"use client";
import type { meetingsList } from "@/lib/meetings-list";
import { hearingDateTime } from "@/lib/areas/format";
export default function MeetingList({
  initial,
  area,
  year,
  filters = {},
}: {
  initial: Awaited<ReturnType<typeof meetingsList>>;
  area: { id: string; name: string; timezone: string };
  year: number;
  filters?: { year?: number; caseId?: string; body?: string };
}) {
  const selectedYear = filters.year ?? year,
    caseId = filters.caseId,
    body = filters.body;
  const data = initial;
  const rows = data.rows.filter(
    (m) =>
      (!caseId || m.caseIds.includes(caseId)) &&
      (!body ||
        m.body === body ||
        (body === "P&Z" && /Planning/i.test(m.body))),
  );
  return (
    <section className="space-y-5">
      <form className="flex flex-wrap items-end gap-4 [&_input]:min-h-11 [&_select]:min-h-11 [&_button]:min-h-11">
        <label>
          Year{" "}
          <select name="year" defaultValue={String(selectedYear)}>
            {Array.from({ length: year - 2022 }, (_, i) => year - i).map(
              (y) => (
                <option key={y}>{y}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Body{" "}
          <select name="body" defaultValue={body ?? ""}>
            <option value="">All bodies</option>
            {[...new Set(initial.rows.map((m) => m.body))].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          Case{" "}
          <input
            name="case"
            defaultValue={caseId}
            className="border p-1"
            placeholder="Optional case number"
          />
        </label>
        <button className="rounded border px-3">Filter</button>
      </form>
      {data.unavailable && (
        <p>Some records could not be verified. Check the official portal.</p>
      )}
      {!rows.length && (
        <p>
          No matching meetings in the collected records. Use the official
          meeting portal for older or unindexed agendas.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((m) => (
          <article key={m.id} className="space-y-3 rounded-xl border p-5">
            <p>{hearingDateTime(m.startsAt, area.timezone)}</p>
            <h2 className="font-semibold">{m.title}</h2>
            {!m.title.toLowerCase().includes(m.body.toLowerCase()) && <p>{m.body}</p>}
            {!!m.projects?.length && <ul className="space-y-3">{m.projects.map(p => <li key={p.caseId}><a href={p.href} className="font-semibold underline">{p.headline}</a><p className="text-sm">{p.caseId}{p.outcome ? " · " + p.outcome + " · " + hearingDateTime(m.date, area.timezone) : ""}</p></li>)}</ul>}
            {!m.projects?.length && <p>{m.caseIds.join(" · ")}</p>}
            <ul>
              {m.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} className="underline">
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
