import WatchedProjects from "@/app/components/watched-projects";
import { getProjectForCase } from "@/lib/projects";
import CaseMap from "@/app/components/maps/case-map";
import { caseCatalog } from "@/lib/case-catalog";
import { StageNavigation } from "@/app/components/project-status";
import { PROJECT_STAGES } from "@/lib/projects";
import type { Metadata } from "next";
import { PENDING_AGENDA_MESSAGE, caseDisplayTitle, getCaseNextHearing } from "@/lib/case-details";
import { projectPathForCase, type ProjectStage } from "@/lib/projects";
import { getCaseStage, getCaseStatus, isStatusUnclear } from "@/lib/localities/stages";
import Link from "next/link";
import { getLocalityContext, localityHref } from "@/lib/locality";
import { getLocality, getTrackedCaseCount, getUpcomingMeetings } from "@/lib/localities";
import type {
  Hearing,
  TrackedItem,
  UpcomingMeeting,
} from "@/lib/localities";

export const metadata: Metadata = {
  title: "What’s coming to Nampa, Idaho",
  alternates: { canonical: "https://www.localagendawatch.com/nampa" },
  description:
    "Explore proposed developments on the Nampa map, upcoming public hearings, and projects you watch.",
};

type LocalityCtx = Awaited<ReturnType<typeof getLocalityContext>>;

type Entry = {
  key: string;
  href: string;
  label: string;
  blurb?: string;
  meta?: string;
  caseIds?: string[];
  caseLinks?: { id: string; href: string }[];
};

function editorialEntry(item: TrackedItem, ctx: LocalityCtx): Entry {
  return {
    key: `editorial:${item.slug}`,
    href: localityHref("nampa", `/${item.slug}`, ctx),
    label: item.label,
    blurb: item.blurb,
    caseIds: item.caseIds,
  };
}

function hearingEntry(h: Hearing, ctx: LocalityCtx, completed = false): Entry {
  const label = caseDisplayTitle(h);
  const blurbParts: string[] = [];
  const stage = getCaseStage(h, completed);
  const nextMeeting = getCaseNextHearing(h);
  if (!isStatusUnclear(h) && stage === "Council hearing" && (!nextMeeting || !/council/i.test(nextMeeting.body))) {
    blurbParts.push("Council date not set");
  } else if (nextMeeting) {
    blurbParts.push(nextMeeting.body + " — " + new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", year: "numeric", month: "long", day: "numeric" }).format(new Date(nextMeeting.startsAt.length === 10 ? nextMeeting.startsAt + "T12:00:00Z" : nextMeeting.startsAt)));
  }
  blurbParts.push(h.appTypeLabel);
  if (h.appAcres != null) blurbParts.push(`${h.appAcres.toFixed(2)} acres`);
  blurbParts.push(getCaseStatus(h));
  return {
    key: `hearing:${h.appId}`,
    href: localityHref("nampa", projectPathForCase(h.appId), ctx),
    label,
    blurb: blurbParts.join(" \u00b7 "),
    meta: h.appId,
    caseLinks: [{ id: h.appId, href: localityHref("nampa", "/plan/" + encodeURIComponent(h.appId), ctx) }],
  };
}

function collapseEntries(entries: Entry[]): Entry[] {
  const groups = new Map<string, Entry>();
  for (const entry of entries) {
    const key = entry.label.toLowerCase().replace(/\s+/g, " ").trim();
    const existing = groups.get(key);
    if (!existing) { groups.set(key, { ...entry }); continue; }
    existing.caseLinks = [...new Map([...(existing.caseLinks ?? []), ...(entry.caseLinks ?? [])].map((c) => [c.id, c])).values()];
    existing.blurb = [...new Set([...(existing.blurb?.split(" · ") ?? []), ...(entry.blurb?.split(" · ") ?? [])])].join(" · ");
    existing.meta = undefined;
  }
  return [...groups.values()];
}

function groupMeetingCases(cases: Hearing[]) {
  const groups = new Map<string, { label: string; cases: Hearing[] }>();
  for (const hearing of cases) {
    const label = caseDisplayTitle(hearing);
    const key = label.toLowerCase();
    const group = groups.get(key) ?? { label, cases: [] };
    group.cases.push(hearing);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const PHASE_ORDER: ProjectStage[] = ["Council hearing", "P&Z hearing", "Under review", "Submitted", "Decided"];
const PHASE_HEADINGS = Object.fromEntries(PHASE_ORDER.map((stage) => [stage, stage])) as Record<ProjectStage, string>;

function groupByPhase(hearings: Hearing[]): Map<ProjectStage, Hearing[]> {
  const buckets = new Map<ProjectStage, Hearing[]>();
  for (const h of hearings) {
    const stage = getCaseStage(h);
    const list = buckets.get(stage) ?? [];
    list.push(h);
    buckets.set(stage, list);
  }
  return buckets;
}

export default async function NampaHub({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const query = await searchParams;
  const selectedStage = PROJECT_STAGES.find((stage) => stage === query?.stage);
  const ctx = await getLocalityContext();
  const nampa = getLocality("nampa");

  const editorialEntries: Entry[] = (nampa?.tracked ?? []).map((t) =>
    editorialEntry(t, ctx)
  );

  const feed = nampa?.getHearings ? await nampa.getHearings() : null;
  const upcoming = feed ? getUpcomingMeetings(feed) : [];
  const catalog = caseCatalog(feed ?? undefined);
  const count = nampa ? getTrackedCaseCount(nampa, feed ?? undefined) : 0;
  const activeBuckets = feed ? groupByPhase(catalog.filter((h) => getCaseStage(h) !== "Decided" && !isStatusUnclear(h))) : null;
  const populatedPhases = activeBuckets
    ? PHASE_ORDER.filter((p) => (!selectedStage || p === selectedStage) && (activeBuckets.get(p)?.length ?? 0) > 0)
    : [];
  const unclearEntries = catalog.filter(isStatusUnclear).map((h) => hearingEntry(h, ctx));
  const completedEntries: Entry[] = feed
    ? catalog.filter((h) => getCaseStage(h) === "Decided").map((h) => hearingEntry(h, ctx, true))
    : [];

  return (
    <div className="flex flex-1 flex-col">
      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        <div className="flex flex-col gap-10">

          <div className="flex flex-col gap-3">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-semibold">What’s coming to Nampa, Idaho</h1>
              <nav aria-label="Nampa sections" className="flex flex-wrap gap-2">
                <a href="#you-are-watching-title" className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">Watching</a>
                <a href="#upcoming-meetings" className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">Meetings</a>
                <a href="#all-cases" className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">All cases</a>
              </nav>
            </header>
            <CaseMap jurisdiction="nampa" fullPage />
          </div>

          {feed?.scheduleUnavailable && (
            <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              Meeting schedule temporarily unavailable. Check the{" "}
              <a href="https://www.cityofnampa.us/1433/Upcoming-Public-Hearings" className="underline underline-offset-2">
                City of Nampa public hearings page
              </a>{" "}
              for the latest hearing schedule. Available PrimeGov meetings are shown below.
            </p>
          )}

          {/* Upcoming meeting hero cards */}
          {!selectedStage && upcoming.length > 0 && (
            <section id="upcoming-meetings">
              <SectionLabel>Upcoming meetings &amp; public hearings</SectionLabel>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((m) => (
                  <MeetingCard key={`${m.body}|${m.date}`} meeting={m} ctx={ctx} />
                ))}
              </div>
            </section>
          )}

          <Link href={localityHref("nampa", "/meetings", ctx)} className="text-sm font-medium underline underline-offset-4">Browse past meetings, agendas &amp; results →</Link>

          <WatchedProjects jurisdiction="nampa" catalog={catalog.map((hearing) => {
            const entry = hearingEntry(hearing, ctx);
            const next = getCaseNextHearing(hearing);
            return { href: "/nampa" + projectPathForCase(hearing.appId), title: getProjectForCase(hearing.appId)?.name ?? entry.label, caseIds: [hearing.appId], status: getCaseStatus(hearing), hearing: next && getCaseStage(hearing) !== "Decided" ? next.body + " — " + new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "long", day: "numeric", year: "numeric" }).format(new Date(next.startsAt.length === 10 ? next.startsAt + "T12:00:00Z" : next.startsAt)) : undefined };
          })} />
          <details id="all-cases" open={Boolean(selectedStage)} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <summary className="cursor-pointer text-lg font-semibold">All cases <span className="ml-2 text-sm font-normal text-zinc-500">({count})</span></summary>
            <div className="mt-6 flex flex-col gap-8">
          <section aria-labelledby="browse-stages-title">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 id="browse-stages-title" className="text-xl font-semibold">Browse by stage</h2>
              <Link href={localityHref("nampa", "", ctx)} aria-current={!selectedStage ? "page" : undefined} className="text-sm underline underline-offset-4">All stages</Link>
            </div>
            <StageNavigation viewing={selectedStage} links={Object.fromEntries(PROJECT_STAGES.map((stage) => [stage, localityHref("nampa", "/?stage=" + encodeURIComponent(stage), ctx)]))} />
            {selectedStage && !populatedPhases.length && !(selectedStage === "Decided" && completedEntries.length) && <p className="mt-4 text-sm text-zinc-500">No cases currently listed at this stage.</p>}
          </section>
          {/* Editorial */}
          {!selectedStage && editorialEntries.length > 0 && (
            <section>
              <SectionLabel>Project guides</SectionLabel>
              <EntryList entries={editorialEntries} className="mt-6" ctx={ctx} />
            </section>
          )}

          {/* Pipeline accordion */}
          {populatedPhases.length > 0 && activeBuckets && (
            <section>
              <SectionLabel>Active cases</SectionLabel>
              <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                {populatedPhases.map((phase, i) => (
                  <PhaseAccordion
                    key={phase}
                    title={PHASE_HEADINGS[phase]}
                    entries={(activeBuckets.get(phase) ?? []).map((h) =>
                      hearingEntry(h, ctx)
                    )}
                    bordered={i > 0}
                    open={Boolean(selectedStage)}
                  />
                ))}
              </div>
            </section>
          )}

          {!selectedStage && unclearEntries.length > 0 && <PhaseAccordion title="Status unclear, no recent city record" entries={unclearEntries} />}
          {/* Recently decided */}
          {(!selectedStage || selectedStage === "Decided") && completedEntries.length > 0 && (
            <details open={selectedStage === "Decided"} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                <span className="text-[10px] text-zinc-400 transition-transform group-open:rotate-90">
                  &#9654;
                </span>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Recently decided
                </h2>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600">
                  {completedEntries.length}
                </span>
              </summary>
              <EntryList entries={completedEntries} muted className="mt-4" />
            </details>
          )}

            </div>
          </details>

          <footer className="border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {feed?.refreshedAt && (
              <p className="mb-2">
                Data last refreshed:{" "}
                <time dateTime={feed.refreshedAt}>
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: "America/Denver",
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(feed.refreshedAt))}
                </time>{" "}(America/Denver)
                {feed.scheduleUnavailable && " · Application data only; meeting schedule unavailable."}
              </p>
            )}
            {nampa?.dataAttribution ?? null}
            {nampa?.dataAttribution && " \u00b7 "}
            Data refreshes automatically. Local Agenda Watch is an independent
            tracker and is not affiliated with the City of Nampa.
          </footer>
        </div>
      </main>
    </div>
  );
}

function SectionLabel({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <h2
      className={`text-xs font-semibold uppercase tracking-widest ${
        muted ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"
      }`}
    >
      {children}
    </h2>
  );
}

function MeetingCard({
  meeting,
  ctx,
}: {
  meeting: UpcomingMeeting;
  ctx: LocalityCtx;
}) {
  const isCC = meeting.body === "City Council";
  const accentBar = isCC ? "bg-sky-500" : "bg-indigo-500";
  const badge = isCC
    ? "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300"
    : "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300";
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className={`h-1.5 ${accentBar}`} />
      <div className="flex flex-1 flex-col gap-5 p-6">
        <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}>
          {meeting.bodyLabel}
        </span>
        <div>
          <time className="block text-2xl font-bold tracking-tight text-black dark:text-zinc-50">
            {meeting.dateLabel}
          </time>
          {meeting.title && <p className="mt-2 text-sm font-medium">{meeting.title}</p>}
          {meeting.timeLabel && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{meeting.timeLabel} (America/Denver)</p>}
          {meeting.location && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{meeting.location}</p>}
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {meeting.hearings.length}{" "}
            {meeting.hearings.length === 1 ? "linked case" : "linked cases"}
          </p>
        </div>
        <ul className="flex-1 divide-y divide-zinc-100 dark:divide-zinc-800">
          {groupMeetingCases(meeting.hearings).map((group) => (
            <li key={group.cases[0].appId} className="py-2.5">
              <p className="text-sm font-medium">{group.label}</p>
              <div className="mt-1 flex flex-wrap gap-3">
                {group.cases.map((h) => <Link key={h.appId} href={localityHref("nampa", projectPathForCase(h.appId), ctx)} className="font-mono text-xs text-zinc-500 underline underline-offset-2 dark:text-zinc-400">{h.appId}</Link>)}
              </div>
            </li>
          ))}
        </ul>
        {meeting.agendaUrl && (
          <a href={meeting.agendaUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline underline-offset-2">View agenda &rarr;</a>
        )}
        {!meeting.agendaUrl && <p className="text-sm text-zinc-500 dark:text-zinc-400">{PENDING_AGENDA_MESSAGE}</p>}
        {meeting.packetUrl && (
          <a href={meeting.packetUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-2">Meeting packet &rarr;</a>
        )}
        <a
          href={meeting.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-zinc-400 hover:text-black dark:hover:text-zinc-50"
        >
          View on City of Nampa website &rarr;
        </a>
      </div>
    </article>
  );
}

function PhaseAccordion({
  title,
  entries,
  bordered,
  open,
}: {
  title: string;
  entries: Entry[];
  bordered?: boolean;
  open?: boolean;
}) {
  return (
    <details open={open}
      className={`group${bordered ? " border-t border-zinc-200 dark:border-zinc-800" : ""}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
        <span className="text-[10px] text-zinc-400 transition-transform group-open:rotate-90">
          &#9654;
        </span>
        <span className="flex-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          {title}
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {entries.length}
        </span>
      </summary>
      <ul className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800/60 dark:border-zinc-800">
        {collapseEntries(entries).map((e) => (
          <li key={e.key}>
            <Link
              href={e.href}
              className="flex items-start gap-4 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-black dark:text-zinc-50">
                  {e.label}
                </span>
                {e.blurb && (
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {e.blurb}
                  </span>
                )}
              </div>
              {e.meta && (
                <span className="shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-600">
                  {e.meta}
                </span>
              )}
            </Link>
            {(e.caseLinks?.length ?? 0) > 1 && <div className="flex flex-wrap gap-4 px-5 pb-4">{e.caseLinks!.map((c) => <Link key={c.id} href={c.href} className="font-mono text-xs underline underline-offset-2">{c.id}</Link>)}</div>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function EntryList({
  entries,
  muted,
  className = "",
  ctx,
}: {
  entries: Entry[];
  muted?: boolean;
  className?: string;
  ctx?: LocalityCtx;
}) {
  return (
    <ul
      className={`divide-y border-y ${
        muted
          ? "divide-zinc-200/60 border-zinc-200/60 dark:divide-zinc-800/60 dark:border-zinc-800/60"
          : "divide-zinc-200 border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
      } ${className}`}
    >
      {collapseEntries(entries).map((e) => (
        <li key={e.key}>
          <Link
            href={e.href}
            className="group flex items-start gap-4 py-4"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-baseline gap-3">
                <span
                  className={`font-medium ${
                    muted
                      ? "text-zinc-500 dark:text-zinc-400"
                      : "text-black dark:text-zinc-50"
                  }`}
                >
                  {e.label}
                </span>
                {e.meta && (
                  <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">
                    {e.meta}
                  </span>
                )}
              </span>
              {e.blurb && (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {e.blurb}
                </span>
              )}
            </div>
            <span className="mt-0.5 shrink-0 text-zinc-300 group-hover:text-zinc-500 dark:text-zinc-700 dark:group-hover:text-zinc-400">
              &rarr;
            </span>
          </Link>
          {(e.caseLinks?.length ?? 0) > 1 && <div className="mb-4 flex flex-wrap gap-4">{e.caseLinks!.map((c) => <Link key={c.id} href={c.href} className="font-mono text-xs underline underline-offset-2">{c.id}</Link>)}</div>}
          {e.caseIds && ctx && (
            <div className="mb-4 flex flex-wrap gap-4">
              {e.caseIds.map((id) => (
                <Link key={id} href={localityHref("nampa", `/plan/${encodeURIComponent(id)}`, ctx)} className="font-mono text-sm underline underline-offset-2">
                  {id}
                </Link>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
