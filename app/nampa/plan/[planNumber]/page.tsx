import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCaseStage } from "@/lib/localities/stages";
import { getProjectForCase } from "@/lib/projects";
import { getLocalityContext, localityHref } from "@/lib/locality";
import { findHearing, getLocality } from "@/lib/localities";
import type { Hearing } from "@/lib/localities";
import type { EnerGovAttachment, EnerGovPlan } from "@/lib/sources/energov";

type RouteParams = { planNumber: string };

async function resolveHearing(planNumber: string): Promise<Hearing | null> {
  const nampa = getLocality("nampa");
  if (!nampa?.getHearings) return null;
  const feed = await nampa.getHearings();
  return (
    findHearing(feed.active, planNumber) ??
    findHearing(feed.completed, planNumber) ??
    findHearing(feed.upcomingOnly ?? [], planNumber)
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { planNumber } = await params;
  const hearing = await resolveHearing(planNumber);
  if (!hearing) return { title: planNumber };
  const title = hearing.appScope
    ? `${hearing.appScope} (${hearing.appId})`
    : `${hearing.appId} \u2014 ${hearing.appTypeLabel}`;
  return {
    title,
    description: `${hearing.appTypeLabel} \u00b7 ${getCaseStage(hearing)} \u2014 filed with the City of Nampa.`,
  };
}

export default async function PlanPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { planNumber } = await params;
  const nampa = getLocality("nampa");
  if (!nampa || !nampa.energov) notFound();

  const hearing = await resolveHearing(planNumber);
  if (!hearing) notFound();

  const project = getProjectForCase(hearing.appId);
  const planId = hearing.energovPlanId;
  const client = nampa.energov;
  const [plan, attachments]: [EnerGovPlan | null, EnerGovAttachment[]] = planId
    ? await Promise.all([
        client.getPlan(planId).catch((err: unknown) => {
          console.error(`[nampa/plan] getPlan(${planId}) failed:`, err);
          return null;
        }),
        client.getPlanAttachments(planId).catch((err: unknown) => {
          console.error(`[nampa/plan] getPlanAttachments(${planId}) failed:`, err);
          return [] as EnerGovAttachment[];
        }),
      ])
    : [null, []];

  const ctx = await getLocalityContext();
  const onNampaSubdomain = ctx.onSubdomain && ctx.subdomainSlug === "nampa";
  const nampaHref = localityHref("nampa", "", ctx);
  const fallbackPortal =
    nampa.portalUrl ?? "https://nampaid-energovpub.tylerhost.net/Apps/SelfService";
  const portalUrl = planId
    ? nampa.energov.planPortalUrl(planId)
    : hearing.externalUrl ?? fallbackPortal;
  const attachmentsUrl = planId
    ? nampa.energov.planPortalUrl(planId, "attachments")
    : hearing.externalUrl ?? fallbackPortal;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10">
        <nav className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
          {!onNampaSubdomain && (
            <>
              <Link href="/" className="hover:text-black dark:hover:text-zinc-50">Home</Link>
              <span>/</span>
            </>
          )}
          <Link href={nampaHref} className="hover:text-black dark:hover:text-zinc-50">Nampa</Link>
        </nav>

        {project && <aside className="rounded-xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-800 dark:bg-sky-950/30">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">This case is part of one development proposal.</p>
          <Link href={localityHref("nampa", "/" + project.slug, ctx)} className="mt-2 inline-block font-semibold underline underline-offset-4">View {project.title}</Link>
        </aside>}
        <PlanHeader hearing={hearing} plan={plan} />
        {hearing.meetings.length > 0 && <OnTheAgendaCard hearing={hearing} />}
        {plan ? <PlanStatusCard plan={plan} /> : <HearingStatusCard hearing={hearing} />}
        {plan && <PlanLocation plan={plan} />}
        <PlanDocuments
          attachments={attachments}
          attachmentsUrl={attachmentsUrl}
          hasPlan={Boolean(plan)}
        />

        <footer className="border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <p>
            Live data from the{" "}
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              City of Nampa Self-Service Portal
            </a>
            . Plan details refresh hourly. Local Agenda Watch is an independent
            tracker and is not affiliated with the City of Nampa or Tyler
            Technologies.
          </p>
        </footer>
      </main>
    </div>
  );
}

function PlanHeader({
  hearing,
  plan,
}: {
  hearing: Hearing;
  plan: EnerGovPlan | null;
}) {
  const derived = plan
    ? [plan.PlanType, plan.Description].filter(Boolean).join(" \u2014 ") ||
      plan.PlanNumber
    : hearing.appTypeLabel;
  const title = hearing.appScope || derived;
  const planNumber = plan?.PlanNumber ?? hearing.appId;
  const status = getCaseStage(hearing);
  const address = plan?.MainAddress ?? null;
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {planNumber}
        </span>
        {status && (
          <span className="inline-flex items-center rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300">
            {status}
          </span>
        )}
      </div>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-4xl">
        {title}
      </h1>
      {address && (
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {address.replace(/\r?\n/g, " \u00b7 ")}
        </p>
      )}
    </header>
  );
}

function OnTheAgendaCard({ hearing }: { hearing: Hearing }) {
  const sourceUrl = hearing.meetings[0]?.sourceUrl;
  // Show only upcoming (non-continued) meetings as active; mute the rest.
  return (
    <section className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-center justify-between gap-4 border-b border-amber-200 px-6 py-4 dark:border-amber-500/20">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-300">
          On the agenda
        </h2>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
          >
            Meeting source &rarr;
          </a>
        )}
      </div>
      <ul className="divide-y divide-amber-200/60 dark:divide-amber-500/20">
        {hearing.meetings.map((m) => (
          <li key={`${m.date}-${m.body}`} className="flex items-start gap-4 px-6 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-semibold text-amber-950 dark:text-amber-100">
                {m.dateLabel}
              </span>
              <span className="text-sm text-amber-800 dark:text-amber-300">
                {m.bodyLabel}
              </span>
              {m.agendaUrl && (
                <a href={m.agendaUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-sm underline underline-offset-2">View agenda item &rarr;</a>
              )}
              {m.staffReports?.map((report) => (
                <a key={report.url} href={report.url} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-2">Staff report: {report.label}</a>
              ))}
              {m.continuedNote && (
                <span className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                  {m.continuedNote}
                </span>
              )}
            </div>
            {m.continuedNote && (
              <span className="mt-0.5 shrink-0 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                Continued
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HearingStatusCard({ hearing }: { hearing: Hearing }) {
  const candidates: Array<[string, string | null]> = [
    ["Type", hearing.appTypeLabel],
    ["Stage", getCaseStage(hearing)],
    ["Acres", hearing.appAcres != null ? hearing.appAcres.toFixed(2) : null],
  ];
  const items = candidates.filter(
    (entry): entry is [string, string] => entry[1] != null && entry[1] !== ""
  );
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Case status
        </h2>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800 sm:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k} className="bg-white px-6 py-4 dark:bg-zinc-950">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{k}</dt>
            <dd className="mt-1 font-medium text-black dark:text-zinc-50">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PlanStatusCard({ plan }: { plan: EnerGovPlan }) {
  const candidates: Array<[string, string | null]> = [
    ["Type", plan.PlanType],
    ["Work class", plan.WorkClassName],
    ["Applied", formatDate(plan.ApplyDate)],
    ["Last action", formatDate(plan.CompleteDate)],
    ["Assigned planner", plan.AssignedTo],
    ["District", plan.DistrictName],
  ];
  const items = candidates.filter(
    (entry): entry is [string, string] => entry[1] != null && entry[1] !== ""
  );

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Case status
        </h2>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800 sm:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k} className="bg-white px-6 py-4 dark:bg-zinc-950">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{k}</dt>
            <dd className="mt-1 font-medium text-black dark:text-zinc-50">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PlanLocation({ plan }: { plan: EnerGovPlan }) {
  if (!plan.MainAddress && !plan.MainParcelNumber) return null;
  const addrQuery = encodeURIComponent(
    (plan.MainAddress ?? "").replace(/\r?\n/g, ", ")
  );
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">Where</h2>
      {plan.MainAddress && (
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
          {plan.MainAddress.split(/\r?\n/).map((line, i) => (
            <span key={i} className="block">{line}</span>
          ))}
        </p>
      )}
      {plan.MainParcelNumber && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Canyon County parcel <span className="font-mono">{plan.MainParcelNumber}</span>
        </p>
      )}
      {addrQuery && (
        <p>
          <a
            href={`https://www.google.com/maps?q=${addrQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-2"
          >
            View on Google Maps
          </a>
        </p>
      )}
    </section>
  );
}

function PlanDocuments({
  attachments,
  attachmentsUrl,
  hasPlan,
}: {
  attachments: EnerGovAttachment[];
  attachmentsUrl: string;
  hasPlan: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Documents
        </h2>
        <a
          href={attachmentsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Open in portal &rarr;
        </a>
      </div>
      {!hasPlan ? (
        <p className="px-6 py-5 text-sm text-zinc-500 dark:text-zinc-400">
          No linked case record in the City of Nampa portal yet. Follow the
          portal link above for the latest documents.
        </p>
      ) : attachments.length === 0 ? (
        <p className="px-6 py-5 text-sm text-zinc-500 dark:text-zinc-400">
          No public attachments on file yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {attachments.map((a) => (
            <li key={a.AttachmentID} className="flex flex-col gap-0.5 px-6 py-4">
              <span className="text-sm font-medium text-black dark:text-zinc-50">
                {a.Notes || a.FileName}
              </span>
              <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                {a.FileName}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Individual file downloads open through the City of Nampa portal.
        </p>
      </div>
    </section>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
