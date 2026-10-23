import { landUseFact } from "@/lib/areas/land-use";
import CaseMap from "@/app/components/maps/case-map";
import { ProjectFacts, ProjectProposal, ProjectTimeline } from "@/app/components/project-overview";
import { buildTimeline, readTimelineState } from "@/lib/timeline/public";
import { braeburnOverview, numericFact, projectOverview, projectDocumentList, BRAEBURN_REPORT } from "@/lib/project-overview";
import { readMapSnapshot } from "@/lib/maps/store";
import { getJurisdiction } from "@/lib/maps/jurisdictions";
import { shortDate } from "@/lib/project-timeline";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getLocality } from "@/lib/localities";
import { getLocalityContext, localityHref } from "@/lib/locality";
import { braeburnCreek, getProjectNextHearing, getProjectStage, PUBLIC_COMMENT_URL } from "@/lib/projects";
import { getProjectDocuments } from "@/lib/project-documents";
import { ProjectNextStep } from "@/app/components/project-next-step";
import ShareProject from "@/app/components/share-project";

const project = braeburnCreek;
const canonical = "https://www.localagendawatch.com/us/id/nampa/" + project.slug;
export const metadata: Metadata = {
  title: project.title, description: project.summary, alternates: { canonical },
  openGraph: { type: "website", title: project.title, description: project.summary, url: canonical,
    images: [{ url: "https://www.localagendawatch.com" + project.image, width: 1535, height: 1054, alt: "Braeburn Creek site at Amity and Happy Valley, outlined on an aerial map" }] },
  twitter: { card: "summary_large_image", title: project.title, description: project.summary, images: ["https://www.localagendawatch.com" + project.image] },
};
export default async function BraeburnCreekPage() {
  const ctx = await getLocalityContext();
  const locality = getLocality("nampa")!;
  const feed = await locality.getHearings?.().catch(() => undefined);
  const state = await readTimelineState();
  const plans = await Promise.all(project.cases.map(async (item) => {
    const planId = item.portalUrl.match(/\/plan\/([^?]+)/)?.[1];
    if (!planId || !locality.energov) return null;
    const plan = await locality.energov.getPlan(planId).catch(() => null);
    return plan ? { caseId: item.id, plan, sourceUrl: item.portalUrl } : null;
  }));
  const timeline = buildTimeline(state, { caseIds: project.caseIds, stage: getProjectStage(project, feed), next: getProjectNextHearing(project, feed), plans: plans.filter((plan) => plan !== null), hearings: [...(feed?.active ?? []), ...(feed?.completed ?? [])].filter((hearing) => project.caseIds.includes(hearing.appId)) });
  for (const hearing of project.pastHearings ?? []) if (!timeline.appearances.some(a => a.isHearing && a.date === hearing.date && /P&Z|Planning/i.test(a.body))) timeline.appearances.push(hearing);
  const stage = timeline.currentStage, next = timeline.next;
  const documents = await getProjectDocuments(project, locality, feed);
  const overview = projectOverview(timeline, braeburnOverview);
  const homes = numericFact(overview.homes), acres = numericFact(overview.acres);
  overview.summary = `Toll Brothers proposes ${homes ?? 487} detached homes on about ${Math.round(acres ?? 138)} acres at Amity & Happy Valley. The applications request annexation, ${overview.zoning?.value ?? "residential zoning"}, and a preliminary subdivision plat.`;
  overview.summarySource = { value: "September staff report", url: BRAEBURN_REPORT, page: 1 };
  const snapshot = await readMapSnapshot("nampa").catch(() => undefined);
  const categories = [...new Set(snapshot?.cases.filter(c => project.caseIds.includes(c.id)).flatMap(c => c.flumCategories) ?? [])];
  const landUse = landUseFact(getJurisdiction("nampa")!.area!, categories, overview.zoning?.value);
  const documentList = projectDocumentList(documents);
  const status = stage === "Decided" ? "Decided" : next ? (/Council/i.test(next.body) ? "Council hearing" : "P&Z hearing") + " · " + shortDate(next.startsAt) : stage === "Council hearing" ? "Council date not set" : stage;
  return <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-8 sm:py-10">
    <nav className="text-sm text-zinc-500"><Link href={localityHref("nampa", "", ctx)} className="underline underline-offset-4">Nampa map</Link><span className="mx-2">/</span>Braeburn Creek</nav>
    <header id="case-status" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Braeburn Creek</h1><p className="mt-3 text-base text-zinc-600 dark:text-zinc-300">{project.location}</p></div><ShareProject title={project.title} summary={overview.summary}/></div>
      <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-sky-100 px-3 py-1.5 text-sm font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">{status}</span>{!timeline.finalDecisionApproved&&<p className="text-sm text-zinc-500">Developer proposal, not yet approved.</p>}</div>
    </header>
    <ProjectFacts overview={overview} landUse={landUse}/>
    {stage!=="Decided"&&<ProjectNextStep hearing={next} calendarHref={localityHref("nampa","/braeburn-creek/hearing.ics",ctx)} concise/>}
    <section aria-label="Project location" className="space-y-3">
      <CaseMap jurisdiction="nampa" caseIds={project.caseIds} compact matchHeightTo='[aria-labelledby="next-step-title"]'/>
      <a href="/us/id/nampa/toll-brothers-site-map.png" className="inline-flex items-center gap-3 text-xs text-zinc-500 underline underline-offset-4"><Image src={project.image} alt="Earlier aerial view of the Braeburn Creek site" width={96} height={66} className="h-14 w-20 rounded-md border border-zinc-200 object-cover dark:border-zinc-800"/>Earlier aerial · March neighborhood notice</a>
    </section>
    <ProjectProposal overview={overview} data={timeline}/>
    <div className="space-y-5"><ProjectTimeline data={timeline}/><Link href={localityHref("nampa","/meetings?case="+project.caseIds[0],ctx)} className="inline-block text-sm underline underline-offset-4">Past meetings, agendas &amp; results</Link></div>
    <section aria-labelledby="cases-title" className="space-y-5">
      <h2 id="cases-title" className="text-2xl font-semibold">Key documents</h2>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 px-5 dark:divide-zinc-800 dark:border-zinc-800">
        {documentList.key.map(doc=><li key={doc.label+doc.url} className="flex flex-wrap items-baseline justify-between gap-2 py-4"><a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline underline-offset-4">{documentTitle(doc.label)}</a>{doc.url !== doc.sourceUrl ? <a href={doc.sourceUrl} className="text-xs text-zinc-500 underline">Official source</a> : <span className="text-xs text-zinc-500">Opens city attachment list</span>}</li>)}
        <li className="py-4"><a href="/us/id/nampa/toll-brothers-concept-plan.png" className="text-sm font-medium underline underline-offset-4">Developer concept / site plan · March 13, 2026</a><p className="mt-1 text-xs text-zinc-500">Neighborhood notice exhibit; later submissions may differ.</p></li>
      </ul>
      <details className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"><summary className="cursor-pointer text-sm font-medium">All city files</summary><div className="mt-4 space-y-5">
        {!!documentList.other.length&&<ul className="space-y-3 text-sm">{documentList.other.map(doc=><li key={doc.label+doc.url}><a href={doc.url} className="underline underline-offset-4">{doc.label}</a></li>)}</ul>}
        {documents.map(item=><div key={item.id}><p className="text-sm font-medium">{item.label} · <span className="font-mono text-xs">{item.id}</span></p><div className="mt-2 flex flex-wrap gap-4 text-sm"><a href={item.portalUrl+"?tab=attachments"} className="underline underline-offset-4">Official case files</a><Link href={localityHref("nampa","/plan/"+item.id,ctx)} className="underline underline-offset-4">Individual case record</Link></div></div>)}
      </div></details>
    </section>
    <footer className="space-y-3 border-t border-zinc-200 pt-6 text-xs leading-6 text-zinc-500 dark:border-zinc-800"><p>Independent summary; city records control. Not affiliated with the developer or the City of Nampa.</p><p>Sources: <a href={BRAEBURN_REPORT} className="underline">September staff report</a> · <a href={PUBLIC_COMMENT_URL} className="underline">Official participation instructions</a> · <a href={getJurisdiction("nampa")!.flum.layerUrl+"?f=pjson"} className="underline">Future Land Use layer</a></p></footer>
  </main>;
}
function documentTitle(label: string) {
  if(/decision[\s_-]*letter/i.test(label))return (/PZ|P&Z|Planning/i.test(label)?"P&Z":"Council")+" decision letter";
  if(/staff[\s_-]*report/i.test(label))return "Staff report · September 29, 2026 P&Z hearing";
  return label.replace(/_/g," ").replace(/\.pdf$/i,"");
}
