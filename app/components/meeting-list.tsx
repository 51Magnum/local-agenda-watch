"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { meetingsList } from "@/lib/meetings-list";
import { hearingDateTime } from "@/lib/areas/format";
export default function MeetingList({
  initial,
  area,
  year,
}: {
  initial: Awaited<ReturnType<typeof meetingsList>>;
  area: { id: string; name: string; timezone: string };
  year: number;
}) {
  const query = useSearchParams(),
    selectedYear = Number(query.get("year") ?? year),
    caseId = query.get("case")?.toUpperCase(),
    body = query.get("body"),
    [loaded, setData] = useState(initial),
    [error, setError] = useState("");
  useEffect(() => {
    if (selectedYear === year) return;
    const controller = new AbortController();
    fetch(
      "/api/meetings?" +
        new URLSearchParams({ area: area.id, year: String(selectedYear) }),
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw Error("Archive unavailable");
        setData(await r.json());
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "The archive could not be loaded. Try the official meeting portal.",
          );
      });
    return () => controller.abort();
  }, [selectedYear, year, area.id, initial]);
  const data = selectedYear === year ? initial : loaded;
  const rows = data.rows.filter(
    (m) =>
      (!caseId || m.caseIds.includes(caseId)) &&
      (!body ||
        m.body === body ||
        (body === "P&Z" && /Planning/i.test(m.body))),
  );
  return (
    <section className="space-y-5">
      <form className="flex gap-4">
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
      {error && <p role="status">{error}</p>}
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
            <p>{m.body}</p>
            <p>{m.caseIds.join(" · ")}</p>
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
