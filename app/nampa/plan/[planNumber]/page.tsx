import NorthsideProjectPage from "@/app/components/northside-project-page";
import CaseMap from "@/app/components/maps/case-map";
import { CaseTimeline, WhatsProposed } from "@/app/components/case-timeline";
import { buildTimeline, readTimelineState, timelineEnabled } from "@/lib/timeline/public";
import { stageNavigationLinks } from "@/lib/stage-navigation";
import type { Metadata } from "next";
import { CaseVisuals } from "@/app/components/case-visuals";
import { CASE_EVIDENCE } from "@/lib/case-evidence";
import { getCaseNextHearing, caseSummary, staffReportLinks, caseDisplayTitle, caseMetaDescription, uniqueAttachments } from "@/lib/case-details";
import { ProjectNextStep } from "@/app/components/project-next-step";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCaseStage, getCaseStatus, isStatusUnclear, latestCouncilDecision } from "@/lib/localities/stages";
import { getProjectForCase } from "@/lib/projects";
import { getLocalityContext, localityHref } from "@/lib/locality";
import { getCaseRecord } from "@/lib/case-record";
import { SITE_ORIGIN } from "@/lib/site-config";
import ShareProject from "@/app/components/share-project";
import { ProjectStatus } from "@/app/components/project-status";
import type { Hearing } from "@/lib/localities";
import type { EnerGovAttachment, EnerGovPlan } from "@/lib/sources/energov";

type RouteParams = { planNumber: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { planNumber } = await params;
  const record = await getCaseRecord(planNumber);
  if (!record) return { title: planNumber, robots: { index: false } };
  const { hearing, plan, attachments } = record;
  const title = caseDisplayTitle(hearing, plan, attachments) + " (" + hearing.appId + ")";
  const summary = caseMetaDescription(hearing, caseDisplayTitle(hearing, plan, attachments), getCaseNextHearing(hearing, record.feed));
  const canonical = SITE_ORIGIN + "/nampa/plan/" + encodeURIComponent(hearing.appId);
  const project = getProjectForCase(hearing.appId);
  const images = [SITE_ORIGIN + (project?.image ?? "/opengraph-image")];
  return { title, description: summary, alternates: { canonical },
    openGraph: { type: "website", title, description: summary, url: canonical, images },
    twitter: { card: "summary_large_image", title, description: summary, images },
  };
}

export default async function PlanPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { planNumber } = await params;
  const record = await getCaseRecord(planNumber);
  if (!record) notFound();
  if (record.hearing.appId === "ANN-00369-2026") return NorthsideProjectPage({record});
  const { locality: nampa, feed, hearing, plan, attachments, attachmentsUnavailable } = record;
  const rawStage = getCaseStage(hearing);
  const next = getCaseNextHearing(hearing, feed);
  const summary = caseSummary(hearing, plan, attachments);
  const project = getProjectForCase(hearing.appId);
  const planId = hearing.energovPlanId;

  const ctx = await getLocalityContext();
  const onNampaSubdomain = ctx.onSubdomain && ctx.subdomainSlug === "nampa";
  const nampaHref = localityHref("nampa", "", ctx);
  const fallbackPortal =
    nampa.portalUrl ?? "https://nampaid-energovpub.tylerhost.net/Apps/SelfService";
  const portalUrl = planId
    ? nampa.energov!.planPortalUrl(planId)
    : hearing.externalUrl ?? fallbackPortal;
  const attachmentsUrl = planId
    ? nampa.energov!.planPortalUrl(planId, "attachments")
    : hearing.externalUrl ?? fallbackPortal;

  const timeline = timelineEnabled(hearing.appId) ? buildTimeline(await readTimelineState(), { caseIds: [hearing.appId], stage: rawStage, next, plans: plan ? [{ caseId: hearing.appId, plan, sourceUrl: portalUrl }] : [], hearings: [hearing] }) : undefined;
  const stage = timeline?.currentStage ?? rawStage;
  const stageLinks = stageNavigationLinks(localityHref("nampa", "/plan/" + hearing.appId, ctx), localityHref("nampa", "/meetings?case=" + hearing.appId, ctx));
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
        <PlanHeader hearing={hearing} plan={plan} summary={summary} title={caseDisplayTitle(hearing, plan, attachments)} verifiedDecision={timeline?.finalDecisionApproved} />
        <ShareProject title={caseDisplayTitle(hearing, plan, attachments) + " (" + hearing.appId + ")"} summary={summary} />
        {timeline ? <CaseTimeline data={timeline} links={stageLinks} /> : <ProjectStatus stage={isStatusUnclear(hearing) ? undefined : stage} statusLabel={getCaseStatus(hearing)} links={stageLinks} />}
        {timeline && <WhatsProposed data={timeline} />}
        <Link href={localityHref("nampa", "/meetings?case=" + hearing.appId, ctx)} prefetch={false} className="text-sm underline underline-offset-4">Past meetings, agendas &amp; results for this case</Link>
        {stage !== "Decided" && <ProjectNextStep emptyMessage={isStatusUnclear(hearing) ? getCaseStatus(hearing) : stage === "Council hearing" ? "Council date not set" : undefined} hearing={next} calendarHref={localityHref("nampa", "/plan/" + encodeURIComponent(hearing.appId) + "/hearing.ics", ctx)} />}
        <CaseMap jurisdiction="nampa" caseIds={[hearing.appId]} compact />
        <CaseVisuals visuals={CASE_EVIDENCE[hearing.appId]?.visuals} reportUrl={CASE_EVIDENCE[hearing.appId]?.reportUrl} />
        <PlanDocuments
          sources={(project?.sourceDocuments ?? []).filter((d) => d.caseIds.includes(hearing.appId) && /decision|findings/i.test(d.label))}
          attachments={attachments}
          attachmentsUrl={attachmentsUrl}
          hasPlan={Boolean(planId)}
          unavailable={attachmentsUnavailable}
          reports={staffReportLinks(hearing, attachments, attachmentsUrl)}
        />
        {hearing.meetings.length > 0 && <OnTheAgendaCard hearing={hearing} />}
        {plan ? <PlanStatusCard plan={plan} /> : <HearingStatusCard hearing={hearing} />}
        {plan && <PlanLocation plan={plan} />}

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
  summary,
  title,
  verifiedDecision,
}: {
  hearing: Hearing;
  plan: EnerGovPlan | null;
  summary: string;
  title: string;
  verifiedDecision?: boolean;
}) {
  const derived = plan
    ? [plan.PlanType, plan.Description].filter(Boolean).join(" \u2014 ") ||
      plan.PlanNumber
    : hearing.appTypeLabel;
  const officialTitle = hearing.appScope || derived;
  const planNumber = plan?.PlanNumber ?? hearing.appId;
  const rawStatus = getCaseStage(hearing);
  const status = verifiedDecision === undefined ? rawStatus : verifiedDecision ? "Decided" : rawStatus === "Decided" ? "Council hearing" : rawStatus;
  const address = plan?.MainAddress ?? null;
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {planNumber}
        </span>
        {status && (
          <span className="inline-flex items-center rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300">
            {isStatusUnclear(hearing) ? getCaseStatus(hearing) : status === "Decided" ? getCaseStatus(hearing) : status}
          </span>
        )}
      </div>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-4xl">
        {title}
      </h1>
      <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">{summary}</p>
      {hearing.appId === "ANN-00369-2026" && <p className="text-sm text-zinc-500">(listed by the city as Nampa Logistics Center)</p>}
      {status !== "Decided" && <p className="w-fit rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200">Developer proposal, not yet approved.</p>}
      <p className="text-sm text-zinc-500 dark:text-zinc-400"><span className="font-medium">Official title:</span> {officialTitle}</p>
      {address && (
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {address.replace(/\r?\n/g, " \u00b7 ")}
        </p>
      )}
    </header>
  );
}

function OnTheAgendaCard({ hearing }: { hearing: Hearing }) {
  const decided = Boolean(latestCouncilDecision(hearing));
  const sourceUrl = hearing.meetings[0]?.sourceUrl;
  // Show only upcoming (non-continued) meetings as active; mute the rest.
  return (
    <section className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-center justify-between gap-4 border-b border-amber-200 px-6 py-4 dark:border-amber-500/20">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-300">
          Hearing record
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
              {m.result && <p className="text-sm font-medium">{m.result}</p>}
              {m.agendaUrl && (
                <a href={m.agendaUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-sm underline underline-offset-2">View agenda item &rarr;</a>
              )}
              {m.continuedNote && !decided && (
                <span className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                  {m.continuedNote}
                </span>
              )}
            </div>
            {m.continuedNote && !decided && (
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
    ["Stage", getCaseStatus(hearing)],
    ["Acres", hearing.appAcres != null ? hearing.appAcres.toFixed(2) : null],
  ];
  const items = candidates.filter(
    (entry): entry is [string, string] => entry[1] != null && entry[1] !== ""
  );
  return (
    <section id="case-status" className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
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
    <section id="case-status" className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
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
  unavailable,
  reports,
  sources = [],
}: {
  attachments: EnerGovAttachment[];
  attachmentsUrl: string;
  hasPlan: boolean;
  unavailable: boolean;
  reports: { label: string; url: string }[];
  sources?: { label: string; url: string }[];
}) {
  return (
    <section id="case-documents" className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
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
      {reports.length > 0 && <ul aria-label="Staff reports" className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {reports.map((report) => <li key={report.label + report.url} className="px-6 py-4"><a href={report.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline underline-offset-4">Staff report: {report.label}</a></li>)}
      </ul>}
      {sources.length > 0 && <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">{sources.map((source) => <li key={source.url} className="px-6 py-4"><a href={source.url} className="text-sm underline underline-offset-4">{source.label}</a></li>)}</ul>}
      {unavailable ? <p className="px-6 py-5 text-sm text-zinc-500 dark:text-zinc-400">Case documents temporarily unavailable here. Open the official portal for the latest files.</p> : !hasPlan ? (
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
          {uniqueAttachments(attachments).filter((a) => !sources.some((source) => source.label === a.FileName) && !a.IsFileSecure && !/staff[\s_-]*report/i.test((a.Notes ?? "") + " " + a.FileName)).map((a) => (
            <li key={a.AttachmentID} className="flex flex-col gap-0.5 px-6 py-4">
              <a href={attachmentsUrl} className="text-sm font-medium text-black underline underline-offset-4 dark:text-zinc-50">
                {a.Notes || a.FileName}
              </a>
              {a.Notes && a.Notes.trim() !== a.FileName.trim() && <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                {a.FileName}
              </span>}
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
