import {redactResidence,blockAddress} from "@/lib/residential-privacy";
import { approvedCaseImages } from "@/lib/maps/image-review-store";
import ReviewedImageGallery from "@/app/components/reviewed-image-gallery";
import { landUseFact } from "@/lib/areas/land-use";
import {stageLabel} from "@/lib/areas/registry";
import {displayArea} from "@/lib/areas/format";
import Link from "next/link";
import CaseMap from "./maps/case-map";
import ShareProject from "./share-project";
import { ProjectNextStep } from "./project-next-step";
import { ProjectFacts, ProjectProposal, ProjectTimeline } from "./project-overview";
import { caseDisplayTitle, getCaseNextHearing, staffReportLinks, uniqueAttachments, uniqueDocumentLinks } from "@/lib/case-details";
import { caseGroupingName, caseLocation, caseProjectOverview } from "@/lib/case-project";
import { caseCatalog } from "@/lib/case-catalog";
import { getCaseStage, getCaseStatus, isStatusUnclear, latestCouncilDecision } from "@/lib/localities/stages";
import { getLocalityContext, localityHref } from "@/lib/locality";
import { getCaseRecord } from "@/lib/case-record";
import { getProjectForCase, PROJECT_STAGES } from "@/lib/projects";
import { buildTimeline, readTimelineState } from "@/lib/timeline/public";
import { shortDate } from "@/lib/project-timeline";
import { projectDocumentList } from "@/lib/project-overview";
import type { ProjectCaseDocuments } from "@/lib/project-documents";
import { readMapSnapshot } from "@/lib/maps/store";
import { getJurisdiction } from "@/lib/maps/jurisdictions";

type RecordData = NonNullable<Awaited<ReturnType<typeof getCaseRecord>>>;
function recordUrls(record: RecordData) {
  const {hearing, locality} = record;
  const portal = hearing.energovPlanId && locality.energov ? locality.energov.planPortalUrl(hearing.energovPlanId) : hearing.externalUrl ?? locality.portalUrl!;
  return {portal, files: hearing.energovPlanId && locality.energov ? locality.energov.planPortalUrl(hearing.energovPlanId, "attachments") : portal};
}
export default async function CaseProjectPage({record}: {record: RecordData}) {
  const {hearing, plan, feed, attachments} = record;
  const ctx = await getLocalityContext();
  const area=displayArea(record.locality.slug);
  const config = getJurisdiction(area.id)!;
  const citywide = config.citywideTypes.includes(hearing.appType);
  const project = getProjectForCase(hearing.appId,area.id);
  const name = caseGroupingName(hearing, plan);
  // Group only a curated project or the city's explicit project name, never shared applicants/addresses.
  const related = caseCatalog(feed).filter(h => h.appId !== hearing.appId && (project ? project.caseIds.includes(h.appId) : name && caseGroupingName(h) === name));
  const siblings = (await Promise.all(related.map(h => getCaseRecord(h.appId,area.id)))).filter((r): r is RecordData => r !== null);
  const records = [record, ...siblings];
  const caseIds = records.map(r => r.hearing.appId);
  const reviewedImages=record.residentialPrivacy?[]:await approvedCaseImages(area.id,caseIds).catch(()=>[]);
  const allDecided = records.every(r => getCaseStage(r.hearing) === "Decided");
  const activeStages = records.map(r => getCaseStage(r.hearing)).filter(s => s !== "Decided");
  const stage = allDecided ? "Decided" : activeStages.sort((a,b) => PROJECT_STAGES.indexOf(b)-PROJECT_STAGES.indexOf(a))[0];
  const nextRecord = records.map(r => ({id:r.hearing.appId, hearing:getCaseNextHearing(r.hearing, feed,new Date(),area.id)})).filter(r => r.hearing !== undefined).sort((a,b) => a.hearing!.startsAt.localeCompare(b.hearing!.startsAt))[0];
  const next = /^(withdrawn|denied|approved)\b/i.test(hearing.appStatus)?undefined:nextRecord?.hearing;
  const state = await readTimelineState(caseIds,area.id);
  const timeline = buildTimeline(state, {areaId:area.id,caseIds, stage, next, plans: records.flatMap(r => r.plan ? [{caseId:r.hearing.appId, plan:r.plan, sourceUrl:recordUrls(r).portal}] : []), hearings: records.map(r => r.hearing)});
  if (allDecided) { timeline.currentStage = "Decided"; timeline.next = undefined; timeline.statusSource = recordUrls(record).portal; }
  timeline.cityDecisions = records.flatMap(r => {
    const decision = latestCouncilDecision(r.hearing);
    return decision ? [{caseId:r.hearing.appId, date:decision.date, result: /^approved/i.test(decision.result!) ? "Approved" : "Denied", sourceUrl:decision.sourceUrl}] : [];
  });
  const decided = allDecided || timeline.finalDecisionApproved;
  const unclear = records.every(r => isStatusUnclear(r.hearing));
  const {portal, files} = recordUrls(record);
  const rawOverview = caseProjectOverview(hearing, plan, attachments, timeline, portal, citywide);
  const overview = record.residentialPrivacy?redactResidence(rawOverview):rawOverview;
  const title = caseDisplayTitle(hearing, plan, attachments);
  const snapshot = !citywide ? await readMapSnapshot(area.id,{caseIds,includeFlum:false}).catch(() => undefined) : undefined;
  const hasGeometry = !snapshot || snapshot.cases.some(c => caseIds.includes(c.id) && c.geometry);
  const categories = [...new Set(snapshot?.cases.filter(c => caseIds.includes(c.id)).flatMap(c => c.flumCategories ?? []) ?? [])];
  const landUse = landUseFact(area, categories, overview.zoning?.value, caseIds[0]);
  const groups: ProjectCaseDocuments[] = records.map(r => {
    const urls = recordUrls(r);
    const reports = staffReportLinks(r.hearing, r.attachments, urls.files);
    const preview=snapshot?.cases.find(c=>c.id===r.hearing.appId)?.visual;
    const imageSource=preview?.documentTitle&&/staff[\s_-]*report|site[\s_-]*plan|concept|prelim/i.test(preview.documentTitle)?[{label:preview.documentTitle,url:preview.sourceUrl,sourceUrl:preview.sourceUrl}]:[];
    const sources = (getProjectForCase(r.hearing.appId,area.id)?.sourceDocuments ?? []).filter(d => d.caseIds.includes(r.hearing.appId));
    const stored = Object.values(state.documents).filter(d => d.caseIds.includes(r.hearing.appId) && d.state === "complete" && d.kind !== "case-record").map(d => ({label:d.title, url:d.url, sourceUrl:d.url}));
    const documents = uniqueDocumentLinks([
      ...sources, ...imageSource, ...reports.map(d => ({...d, sourceUrl:urls.portal})), ...stored,
      ...uniqueAttachments(r.attachments).filter(a => !sources.some(d => d.fileNames?.includes(a.FileName)) && !(/staff[\s_-]*report/i.test(a.FileName+" "+a.Notes) && reports.some(d=>d.url!==urls.files))).map(a => ({label:a.FileName, url:urls.files, sourceUrl:urls.portal})),
      ...r.hearing.meetings.filter(m => m.agendaUrl).map(m => ({label:"Agenda · "+shortDate(m.date), url:m.agendaUrl!, sourceUrl:m.sourceUrl})),
    ]);
    return {id:r.hearing.appId, label:caseDisplayTitle(r.hearing,r.plan,r.attachments), portalUrl:urls.portal, retrievalFailed:r.attachmentsUnavailable, documents};
  });
  const documents = projectDocumentList(groups, true);
  const status = unclear ? getCaseStatus(hearing) : decided ? (getCaseStatus(hearing).startsWith("Decided") ? getCaseStatus(hearing) : "Decided") : next ? (/Council|Board/i.test(next.body)?"Council hearing":"P&Z hearing")+" · "+shortDate(next.startsAt,area.timezone) : stage === "Council hearing" ? area.bodies.decision.shortLabel+" date not set" : stageLabel(stage,area);
  const location = citywide ? "Citywide · "+area.name+", "+area.stateName : record.residentialPrivacy?blockAddress(caseLocation(hearing,plan)??""):caseLocation(hearing,plan);
  const terms: ("annexation"|"rezone"|"preliminary plat")[] = [];
  if (records.some(r => r.hearing.appType === "ANN")) terms.push("annexation");
  if (records.some(r => ["ANN","ZMA"].includes(r.hearing.appType))) terms.push("rezone");
  if (records.some(r => r.hearing.appType === "SPP")) terms.push("preliminary plat");
  return <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-8 sm:py-10">
    <nav className="text-sm text-zinc-500"><Link href={localityHref(area.id,"",ctx)} className="underline underline-offset-4">{area.name} map</Link><span className="mx-2">/</span>{name ?? hearing.appId}</nav>
    <header id="case-status" className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>{location&&<p className="mt-3 text-base text-zinc-600 dark:text-zinc-300">{location}</p>}</div><ShareProject title={title+" ("+hearing.appId+")"} summary={overview.summary!}/></div><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-sky-100 px-3 py-1.5 text-sm font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">{stageLabel(status,area)}</span>{!decided&&!unclear&&<p className="text-sm text-zinc-500">{citywide?"Proposal, not yet approved.":"Developer proposal, not yet approved."}</p>}</div>{project&&<Link href={localityHref(area.id,"/"+project.slug,ctx)} className="inline-block text-sm underline underline-offset-4">View {project.name} project</Link>}</header>
    <ProjectFacts overview={overview} landUse={landUse}/>
    {!decided&&!unclear&&<ProjectNextStep areaId={area.id} hearing={next} emptyMessage={stage==="Council hearing"?area.bodies.decision.shortLabel+" date not set":undefined} calendarHref={localityHref(area.id,"/plan/"+(nextRecord?.id??hearing.appId)+"/hearing.ics",ctx)} concise/>}
    {!citywide&&hasGeometry&&<CaseMap jurisdiction={area.id} caseIds={caseIds} compact matchHeightTo='[aria-labelledby="next-step-title"]'/>}
    <ReviewedImageGallery visuals={reviewedImages}/>
    <ProjectProposal areaId={area.id} overview={overview} data={timeline} terms={terms}/>
    <div className="space-y-5">{!unclear&&<ProjectTimeline areaId={area.id} data={timeline}/>}<Link href={localityHref(area.id,"/meetings?case="+hearing.appId,ctx)} className="text-sm underline underline-offset-4">Past meetings, agendas &amp; results</Link></div>
    <section id="case-documents" aria-label="Project documents" className="space-y-5">
      {!!documents.key.length&&<><h2 id="key-documents-title" className="text-2xl font-semibold">Key documents</h2><ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 px-5 dark:divide-zinc-800 dark:border-zinc-800">{documents.key.map(d=><li key={d.label+d.url} className="py-4"><a href={d.url} className="text-sm font-medium underline underline-offset-4">{d.label}</a></li>)}</ul></>}
      <details className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"><summary className="cursor-pointer text-sm font-medium">All city files{records.length>1?" · "+records.length+" related cases":""}</summary><div className="mt-4 space-y-5 text-sm">{records.map(r=><div key={r.hearing.appId} className="space-y-2"><Link href={localityHref(area.id,"/plan/"+r.hearing.appId,ctx)} className="font-mono text-xs underline">{r.hearing.appId}</Link><p><span className="font-medium">Official title:</span> {r.hearing.appScope||r.plan?.Description||r.hearing.appTypeLabel}</p><a href={recordUrls(r).files} target="_blank" rel="noopener noreferrer" className="inline-block underline underline-offset-4">Official case files</a>{r.attachmentsUnavailable&&<p className="text-xs text-zinc-500">The city file portal is temporarily unavailable here. <Link href={localityHref(area.id,"/meetings?case="+r.hearing.appId,ctx)} className="underline">Browse meeting packets and staff reports instead</Link>.</p>}</div>)}{!!documents.portal.length&&<div className="space-y-2"><p className="text-xs text-zinc-500">The filenames below are listed in the city portal, which may return an access error. They are not direct PDF downloads. Use the public meeting documents above when available.</p><ul className="list-disc space-y-2 pl-5">{documents.portal.map(d=><li key={d.label} className="text-xs text-zinc-500">{d.label}</li>)}</ul></div>}{documents.other.map(d=><p key={d.label+d.url}><a href={d.url} className="underline underline-offset-4">{d.label}</a></p>)}</div></details>
    </section>
    <footer className="space-y-3 border-t border-zinc-200 pt-6 text-xs leading-6 text-zinc-500 dark:border-zinc-800"><p>Independent summary; city records control. Not affiliated with the developer or {area.type==="city"?"the City of ":""}{area.name}.</p><p>Sources: <a href={portal} className="underline">Official case record</a> · <a href={files} target="_blank" rel="noopener noreferrer" className="underline">City files</a></p></footer>
  </main>;
}




