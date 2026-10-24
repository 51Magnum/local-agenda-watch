import { approvedCaseImages } from "@/lib/maps/image-review-store";
import ReviewedImageGallery from "@/app/components/reviewed-image-gallery";
import { landUseFact } from "@/lib/areas/land-use";
import Link from "next/link";
import CaseMap from "@/app/components/maps/case-map";
import ShareProject from "@/app/components/share-project";
import { ProjectNextStep } from "@/app/components/project-next-step";
import { ProjectFacts, ProjectProposal, ProjectTimeline } from "@/app/components/project-overview";
import { getCaseNextHearing, caseSummary, uniqueAttachments, uniqueDocumentLinks, staffReportLinks } from "@/lib/case-details";
import { getCaseStage, getCaseStatus } from "@/lib/localities/stages";
import { getLocalityContext, localityHref } from "@/lib/locality";
import { getCaseRecord } from "@/lib/case-record";
import { buildTimeline, readTimelineState } from "@/lib/timeline/public";
import { shortDate } from "@/lib/project-timeline";
import { projectOverview } from "@/lib/project-overview";
import { northsideOverview, NORTHSIDE_REPORT } from "@/lib/northside-project";
import { readMapSnapshot } from "@/lib/maps/store";
import { getJurisdiction } from "@/lib/maps/jurisdictions";

type RecordData=NonNullable<Awaited<ReturnType<typeof getCaseRecord>>>;
export default async function NorthsideProjectPage({record}:{record:RecordData}){
  const {hearing,plan,feed,attachments,locality}=record;
  const reviewedImages=await approvedCaseImages(locality.slug,[hearing.appId]).catch(()=>[]);
  const ctx=await getLocalityContext(),stage=getCaseStage(hearing),next=getCaseNextHearing(hearing,feed);
  const portal=hearing.energovPlanId?locality.energov!.planPortalUrl(hearing.energovPlanId):hearing.externalUrl??locality.portalUrl!;
  const files=hearing.energovPlanId?locality.energov!.planPortalUrl(hearing.energovPlanId,"attachments"):portal;
  const timeline=buildTimeline(await readTimelineState([hearing.appId]),{caseIds:[hearing.appId],stage,next,plans:plan?[{caseId:hearing.appId,plan,sourceUrl:portal}]:[],hearings:[hearing]});
  // Direct city status remains authoritative; extracted outcomes still require review.
  if(stage==="Decided"){timeline.currentStage="Decided";timeline.next=undefined;timeline.statusSource=portal;}
  if(!timeline.appearances.some(a=>a.isHearing&&a.date==="2026-09-29"&&/P&Z|Planning/i.test(a.body)))timeline.appearances.push({date:"2026-09-29",body:"Planning & Zoning",isHearing:true,sourceUrl:CASE_SOURCE});
  const overview=projectOverview(timeline,northsideOverview);
  const summary=caseSummary(hearing,plan,attachments);
  overview.summary=summary+" The staff report describes future warehouse and manufacturing uses; this application requests annexation and zoning rather than approval of a specific building.";
  const snapshot=await readMapSnapshot("nampa",{caseIds:[hearing.appId],includeFlum:false}).catch(()=>undefined);
  const categories=snapshot?.cases.find(c=>c.id===hearing.appId)?.flumCategories??[];
  const landUse = landUseFact(getJurisdiction("nampa")!.area!, categories, overview.zoning?.value, hearing.appId);
  const reports=staffReportLinks(hearing,attachments,files).filter((report,_,all)=>!(report.url===files&&/^staff[\s_-]*report(?:\.pdf)?$/i.test(report.label)&&all.some(other=>other.url!==files)));
  const all=uniqueDocumentLinks([...reports.map(r=>({...r,sourceUrl:CASE_SOURCE})),...uniqueAttachments(attachments).filter(a=>!a.IsFileSecure&&!/staff[\s_-]*report/i.test((a.Notes??"")+" "+a.FileName)).map(a=>({label:a.Notes||a.FileName,url:files,sourceUrl:portal}))]);
  const key=all.filter(d=>/staff[\s_-]*report|decision|findings|reasoned|site[\s_-]*plan|concept/i.test(d.label));
  const status=timeline.finalDecisionApproved?"Decided":stage==="Decided"?getCaseStatus(hearing):next?(/Council/i.test(next.body)?"Council hearing":"P&Z hearing")+" · "+shortDate(next.startsAt):stage==="Council hearing"?"Council date not set":stage;
  const decided=stage==="Decided"||timeline.finalDecisionApproved;
  return <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-8 sm:py-10">
    <nav className="text-sm text-zinc-500"><Link href={localityHref("nampa","",ctx)} className="underline underline-offset-4">Nampa map</Link><span className="mx-2">/</span>Northside Logistics Center</nav>
    <header id="case-status" className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Northside Logistics Center</h1><p className="mt-3 text-base text-zinc-600 dark:text-zinc-300">{plan?.MainAddress?.replace(/\r?\n/g,", ")||"17501 Northside Blvd, Nampa, ID 83687"}</p></div><ShareProject title="Northside Logistics Center annexation" summary={summary}/></div><p className="text-sm text-zinc-500">(listed by the city as Nampa Logistics Center)</p><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-sky-100 px-3 py-1.5 text-sm font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">{status}</span>{!decided&&<p className="text-sm text-zinc-500">Developer proposal, not yet approved.</p>}</div></header>
    <ProjectFacts overview={overview} landUse={landUse}/>
    {!decided&&<ProjectNextStep hearing={next} emptyMessage={stage==="Council hearing"?"Council date not set":undefined} calendarHref={localityHref("nampa","/plan/"+hearing.appId+"/hearing.ics",ctx)} concise/>}
    <CaseMap jurisdiction="nampa" caseIds={[hearing.appId]} compact matchHeightTo='[aria-labelledby="next-step-title"]'/>
    <ReviewedImageGallery visuals={reviewedImages}/>
    <ProjectProposal overview={overview} data={timeline} terms={["annexation","rezone"]}/>
    <div className="space-y-5"><ProjectTimeline data={timeline}/><Link href={localityHref("nampa","/meetings?case="+hearing.appId,ctx)} className="text-sm underline underline-offset-4">Past meetings, agendas &amp; results</Link></div>
    <section id="case-documents" aria-labelledby="key-documents-title" className="space-y-5"><h2 id="key-documents-title" className="text-2xl font-semibold">Key documents</h2><ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 px-5 dark:divide-zinc-800 dark:border-zinc-800">{key.map(d=><li key={d.label+d.url} className="py-4"><a href={d.url} className="text-sm font-medium underline underline-offset-4">{/staff[\s_-]*report/i.test(d.label)?"Staff report · September 29, 2026 P&Z hearing":d.label}</a></li>)}</ul>
      <details className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"><summary className="cursor-pointer text-sm font-medium">All city files</summary><div className="mt-4 space-y-4 text-sm"><p className="font-mono text-xs">{hearing.appId}</p><p><span className="font-medium">Official title:</span> {hearing.appScope||plan?.Description||hearing.appTypeLabel}</p>{all.filter(d=>!key.includes(d)).map(d=><p key={d.label+d.url}><a href={d.url} className="underline underline-offset-4">{d.label}</a></p>)}<a href={files} target="_blank" rel="noopener noreferrer" className="inline-block underline underline-offset-4">Official case files</a></div></details>
    </section>
    <footer className="space-y-3 border-t border-zinc-200 pt-6 text-xs leading-6 text-zinc-500 dark:border-zinc-800"><p>Independent summary; city records control. Not affiliated with the developer or the City of Nampa.</p><p>Sources: <a href={NORTHSIDE_REPORT} className="underline">September staff report</a> · <a href={portal} className="underline">Official case record</a></p></footer>
  </main>;
}
const CASE_SOURCE="https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062";
