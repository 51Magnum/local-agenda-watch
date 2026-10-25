import {residentialCase,redactResidence,privateResidentialDocument} from "@/lib/residential-privacy";
import {privacyOverrides} from "@/lib/residential-privacy-store";
import {participationClosed} from "@/lib/participation";
import { approvedCaseImages } from "@/lib/maps/image-review-store";
import ReviewedImageGallery from "@/app/components/reviewed-image-gallery";
import { readTimelineState } from "@/lib/timeline/public";
import { publicFields } from "@/lib/timeline/types";
import MapSummaryEvidence from "@/app/components/map-summary-evidence";
import { residentHref } from "./record-links";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CaseMap from "@/app/components/maps/case-map";
import ShareProject from "@/app/components/share-project";
import WatchedProjects from "@/app/components/watched-projects";
import { ProjectNextStep } from "@/app/components/project-next-step";
import { ProjectFacts } from "@/app/components/project-overview";
import type {Hearing,HearingFeed} from "@/lib/localities/types";
import { caseCatalog } from "@/lib/case-catalog";
import { getCaseNextHearing } from "@/lib/case-details";
import type {PublicCaseRecord,RecordEvent} from "@/lib/localities/record-types";
import { areaPath, AREAS } from "./registry";
import { areaDate, areaTime } from "./format";
import { readMapSnapshot } from "@/lib/maps/store";
import { hearingCalendar } from "@/lib/projects";
type RecordCase=Hearing&{record:PublicCaseRecord};
export function createRecordAreaPages(config:{areaId:string;loadFeed:()=>Promise<HearingFeed>;record:(hearing:Hearing)=>PublicCaseRecord;title:(hearing:Hearing)=>string;summary:(hearing:Hearing)=>string;stage:(hearing:Hearing)=>string;sourceLabel:string;sourceUrl:string;dataWindow:string;showMap?:boolean;groupMeetings?:boolean;facts?:(hearing:Hearing)=>import("@/lib/project-overview").ProjectOverview}){
const area=AREAS[config.areaId], base=areaPath(area), pill="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";
const date=(value:string)=>areaDate(value,area,{month:"short",day:"numeric",year:"numeric"});
const stage=(h:RecordCase)=>{const value=config.stage(h);return value==="Council/Board"?area.bodies.decision.stageLabel:value==="P&Z"?area.bodies.planning.stageLabel:value;};
const titleForCase=config.title,summaryForCase=config.summary;
const loadFeed=config.loadFeed;
const recordUrl=(h:RecordCase, cases:RecordCase[]=[]):string|undefined=>{
 const urlsFor=(c:RecordCase)=>[c.externalUrl,...(c.record.documents??[]).map(d=>d.url),...c.record.events.flatMap(e=>[e.sourceUrl,...e.documents.map(d=>d.url)]),c.record.sourceUrl];
 const parent=cases.find(c=>c.appId===h.appId.replace(/-(?:APL|MOD)$/i,"" )&&c.appId!==h.appId);
 const context={urls:urlsFor(h),baseRecordUrl:parent?area.recordPage?.({urls:urlsFor(parent)}):undefined};
 return area.recordPage?area.recordPage(context):context.urls.map(residentHref).find(Boolean);
};
function Source({url,children,className="text-xs underline underline-offset-4"}:{url?:string;children:React.ReactNode;className?:string}){
 const href=residentHref(url);return href?<a href={href} className={className}>{children}</a>:null;
}
const catalog=(feed:HearingFeed)=>caseCatalog(feed).map(h=>({...h,record:config.record(h)})) as RecordCase[];
function allEvents(cases:RecordCase[]){
 const events=[...new Map(cases.flatMap(c=>c.record.events).map(e=>[e.id,e])).values()];
 if(!config.groupMeetings)return events.sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
 const groups=new Map<string,RecordEvent>();
 for(const event of events){const key=event.body+event.date+(event.result??"");const prior=groups.get(key);groups.set(key,prior?{...prior,caseIds:[...new Set([...prior.caseIds,...event.caseIds])],documents:[...prior.documents,...event.documents]}:{...event,id:key});}
 return [...groups.values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
function Warning({unavailable,lastUpdated}:{unavailable?:boolean;lastUpdated?:string}){return unavailable?<p role="status" className="rounded-lg border border-amber-400 p-4 text-sm">Some official sources are temporarily unavailable. Cached records may be out of date.{lastUpdated?" Last updated: "+date(lastUpdated)+".":""} <a href={config.sourceUrl} className="underline">Check the official hearing calendar</a>.</p>:null;}
function MeetingCard({event,cases}:{event:RecordEvent;cases:RecordCase[]}) {
 const related=[...new Map(cases.filter(c=>event.caseIds.includes(c.appId)).map(c=>[titleForCase(c).replace(/[’]/g,"'").toLowerCase(),c])).values()];
 return <article className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"><p className="text-sm font-semibold text-sky-700 dark:text-sky-400">{date(event.date)}{event.time?" · "+areaTime(event.startsAt,area):""}</p><h3 className="font-semibold">{event.body==="P&Z"?area.bodies.planning.label:event.body}</h3><ul className="space-y-2">{related.map(c=><li key={c.appId}><Link href={base+"/plan/"+encodeURIComponent(c.appId)} className="text-sm underline underline-offset-4">{titleForCase(c)}</Link></li>)}</ul><p className="text-sm">{event.result??(event.date<new Intl.DateTimeFormat("en-CA",{timeZone:area.timezone}).format(new Date())?"Result pending official record":"Hearing scheduled")}</p>{event.deadline&&<p className="text-sm text-zinc-500">Written-comment deadline: {date(event.deadline)} (time not specified)</p>}<Source url={event.sourceUrl} className="inline-block text-sm underline underline-offset-4">Official hearing, documents &amp; comment details →</Source></article>;
}
async function RecordHub() {
 const feed=await loadFeed(), cases=catalog(feed), today=new Intl.DateTimeFormat("en-CA",{timeZone:area.timezone}).format(new Date());
 const events=allEvents(cases).filter(e=>e.date>=today&&!/cancelled|canceled|continued|tabled/i.test(e.result??""));
 const watches=cases.map(c=>({href:base+"/plan/"+encodeURIComponent(c.appId),title:titleForCase(c),caseIds:[c.appId],status:stage(c),hearing:c.record.events.find(e=>e.date>=today)?.date}));
 return <main className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-6 py-6"><header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-xl font-semibold">What’s coming to {area.name}, {area.stateName}</h1><nav className="flex flex-wrap gap-2"><a href="#you-are-watching-title" className={pill}>Watching</a><a href="#meetings" className={pill}>Meetings</a><a href="#all-cases" className={pill}>All cases</a></nav></header><Warning unavailable={feed.scheduleUnavailable||feed.dataUnavailable} lastUpdated={feed.scheduleRefreshedAt}/>{feed.scheduleUnavailable&&feed.scheduleRefreshedAt&&<p className="text-xs text-zinc-500">Hearing notices last verified: {date(feed.scheduleRefreshedAt)}</p>}{config.showMap!==false&&<CaseMap jurisdiction={area.id} fullPage/>}<p className="text-xs text-zinc-500">{area.coverageNote}</p><WatchedProjects jurisdiction={area.id} catalog={watches}/><section id="meetings" aria-labelledby="area-hearings-title" className="space-y-5"><h2 id="area-hearings-title" className="text-2xl font-semibold">Upcoming hearings</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{events.slice(0,9).map(event=><MeetingCard key={event.id} event={event} cases={cases}/>)}</div>{!events.length&&<p>No upcoming hearing confirmed. Check the official meeting calendar.</p>}<Link href={base+"/meetings"} className="inline-block text-sm underline underline-offset-4">Browse hearings, agendas &amp; results →</Link></section><section id="all-cases"><details open={config.showMap===false?true:undefined} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"><summary className="cursor-pointer font-semibold">All {area.name} cases · {cases.length}</summary><p className="mt-3 text-xs text-zinc-500">{config.dataWindow}</p>{[false,true].filter(decided=>cases.some(c=>Boolean(c.decisionRecorded)===decided)).map(decided=><div key={String(decided)} className="mt-6"><h3 className="font-semibold">{decided?"Decided / closed":"In progress"}</h3><ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">{cases.filter(c=>Boolean(c.decisionRecorded)===decided).map(c=><li key={c.appId} className="flex flex-wrap items-baseline justify-between gap-2 py-3"><Link href={base+"/plan/"+encodeURIComponent(c.appId)} className="text-sm underline underline-offset-4">{titleForCase(c)}</Link><span className="text-xs text-zinc-500">{c.appId} · {stage(c)}{c.decisionRecorded?" · "+c.appStatus:""}</span></li>)}</ul></div>)}</details></section><footer className="space-y-2 border-t border-zinc-200 pt-5 text-xs text-zinc-500 dark:border-zinc-800"><p>{cases.length} cases tracked{feed.refreshedAt?" · Data last refreshed: "+areaDate(feed.refreshedAt,area,{dateStyle:"medium",timeStyle:"short"})+" (America/Denver)":""}</p><p>{config.sourceLabel}. Independent summary; official records control.</p></footer></main>;
}
async function RecordCaseMetadata({params}:{params:Promise<{planNumber:string}>}):Promise<Metadata>{
 const id=(await params).planNumber.toUpperCase(),feed=await loadFeed(),h=catalog(feed).find(c=>c.appId===id) as RecordCase|undefined;
 if(!h)return {title:"Case not found"};
 const sensitive=residentialCase(area.id,id,h,await privacyOverrides()),publicH=sensitive?redactResidence(h):h;
 const title=titleForCase(publicH),next=getCaseNextHearing(h,feed,new Date(),area.id),description=title+". "+stage(h)+(h.decisionRecorded?" · "+h.appStatus:"")+"."+(next?" Next hearing: "+date(next.startsAt)+".":"");
 return {title:{absolute:title+" | Local Agenda Watch"},description,alternates:{canonical:"https://www.localagendawatch.com"+base+"/plan/"+encodeURIComponent(id)},openGraph:{title,description,images:[base+"/opengraph-image"]}};
}
async function RecordCasePage({params}:{params:Promise<{planNumber:string}>}){
 const id=(await params).planNumber.toUpperCase(),feed=await loadFeed(),cases=catalog(feed);let h=cases.find(c=>c.appId===id);if(!h)notFound();
 const sensitive=residentialCase(area.id,id,h,await privacyOverrides());if(sensitive)h=redactResidence(h);
 const mapSummaryFields=publicFields(await readTimelineState([id],area.id),[id],area.id);
 const reviewedImages=sensitive?[]:await approvedCaseImages(area.id,[id]).catch(()=>[]);
 const publicRecordUrl=recordUrl(h,cases);
 const overview=config.facts?.(h)??{variant:"nonresidential" as const,request:{value:h.appTypeLabel,url:publicRecordUrl??""}};
 for(const value of Object.values(overview))if(value&&typeof value==="object"&&"url" in value&&!residentHref(value.url))value.url=publicRecordUrl??"";
 const title=titleForCase(h),summary=summaryForCase(h),next=participationClosed(h)?undefined:getCaseNextHearing(h,feed,new Date(),area.id),href=base+"/plan/"+encodeURIComponent(id);
 let snapshot;try{snapshot=await readMapSnapshot(area.id,{caseIds:[id],includeFlum:false});}catch{/* Map can load independently. */}
 const mapped=snapshot?.cases.find(c=>c.id===id),flum=mapped?.flumCategories.join(" / ");
 const documents=[...new Map([...(h.record.documents??[]),...h.record.events.flatMap(e=>e.documents)].map(d=>[d.url,d])).values()].filter(d=>residentHref(d.url)&&(!sensitive||!privateResidentialDocument(d.label+" "+d.filename)));
 const key=documents.filter(d=>/staff report|FCO|findings|decision|plat|site plan|meeting packet|official application materials|public hearing notice|proposed ordinance|^Agenda$/i.test(d.label+" "+d.filename));
 const other=documents.filter(d=>!key.includes(d));
 const related=[...new Set(h.record.events.flatMap(e=>e.caseIds))].filter(caseId=>caseId!==id&&cases.some(c=>c.appId===caseId));
 return <main className="mx-auto w-full max-w-5xl flex-1 space-y-9 px-6 py-8"><Link href={base} className="text-sm underline">← {area.name}</Link><header className="space-y-4"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>{h.record.address&&<p className="text-zinc-500">{h.record.address}</p>}<p className="font-mono text-xs text-zinc-500">{id}</p><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-sky-100 px-3 py-2 text-sm text-sky-950 dark:bg-sky-950 dark:text-sky-200">{stage(h)}{h.decisionRecorded?" · "+h.appStatus:next?" · "+date(next.startsAt):""}</span>{!h.decisionRecorded&&<span className="text-sm text-zinc-500">Applicant proposal, not yet approved.</span>}</div><ShareProject title={title} summary={summary}/>{!!related.length&&<p className="flex flex-wrap gap-3 text-xs text-zinc-500">Related cases: {related.map(caseId=><Link key={caseId} href={base+"/plan/"+encodeURIComponent(caseId)} className="underline">{caseId}</Link>)}</p>}</header><Warning unavailable={feed.scheduleUnavailable||feed.dataUnavailable} lastUpdated={feed.scheduleRefreshedAt}/>{feed.scheduleUnavailable&&feed.scheduleRefreshedAt&&<p className="text-xs text-zinc-500">Hearing notices last verified: {date(feed.scheduleRefreshedAt)}</p>}<ProjectFacts overview={overview} landUse={flum?{value:flum,url:base+"/map?flum=1&case="+encodeURIComponent(id),mapHref:base+"/map?flum=1&case="+encodeURIComponent(id)}:undefined}/>{!participationClosed(h)&&<div id="area-next-step"><ProjectNextStep areaId={area.id} hearing={next} calendarHref={href+"/hearing.ics"} concise/></div>}{!h.citywide&&(!snapshot||mapped?.geometry)&&<CaseMap jurisdiction={area.id} caseIds={[id]} compact matchHeightTo="#area-next-step"/>}<ReviewedImageGallery visuals={reviewedImages}/><section className="space-y-3" aria-labelledby="whats-proposed-title"><h2 id="whats-proposed-title" className="text-2xl font-semibold">What’s proposed</h2><MapSummaryEvidence fields={mapSummaryFields}/><p className="leading-8">{summary}</p><Source url={publicRecordUrl} className="text-xs underline underline-offset-4">Official case description</Source></section><section className="space-y-5" aria-labelledby="timeline-title"><h2 id="timeline-title" className="text-2xl font-semibold">Project timeline</h2><ol className="space-y-5 border-l-2 border-zinc-200 pl-6 dark:border-zinc-800">{h.record.appliedDate&&<li><h3 className="font-semibold">Filed</h3><p className="mt-1 text-sm">{date(h.record.appliedDate)}{residentHref(publicRecordUrl)&&<> · <Source url={publicRecordUrl} className="underline">Source</Source></>}</p></li>}{h.record.reviewDate&&<li><h3 className="font-semibold">In review</h3><p className="mt-1 text-sm">{date(h.record.reviewDate)}{residentHref(publicRecordUrl)&&<> · <Source url={publicRecordUrl} className="underline">Source</Source></>}</p></li>}{h.record.events.map(e=><li key={e.id}><h3 className="font-semibold">{e.body==="P&Z"?area.bodies.planning.label:e.body}</h3><p className="mt-1 text-sm leading-7">{date(e.date)} · {e.result??(e.date<new Intl.DateTimeFormat("en-CA",{timeZone:area.timezone}).format(new Date())?"Met; result pending minutes or decision record":"Upcoming hearing")}{residentHref(e.sourceUrl)&&<> · <Source url={e.sourceUrl} className="underline">Source</Source></>}</p>{e.note&&<p className="text-xs text-zinc-500">{e.note}</p>}</li>)}{!h.record.events.length&&<li><p className="text-sm">{h.decisionRecorded?h.appStatus:"In review"}{h.record.decisionDate?" · "+date(h.record.decisionDate):""}{residentHref(publicRecordUrl)&&<> · <Source url={publicRecordUrl} className="underline">Official case record</Source></>}</p></li>}</ol><p className="text-xs text-zinc-500">A recommendation is separate from a final decision. Hearings can be continued or appealed.</p><Link href={base+"/meetings?case="+encodeURIComponent(id)} className="inline-block text-sm underline">Hearings, agendas &amp; results for this case →</Link></section><section className="space-y-4" aria-labelledby="documents-title"><h2 id="documents-title" className="text-2xl font-semibold">{key.length?"Key documents":"City files"}</h2>{!publicRecordUrl&&<p className="text-xs text-zinc-500">Source: {area.name} planning records</p>}{!documents.length&&<Source url={publicRecordUrl} className="text-sm underline">Official case record</Source>}<ul className="space-y-3">{key.map(d=><li key={d.url}><a href={d.url} className="text-sm underline underline-offset-4">{d.label}</a><span className="ml-2 text-xs text-zinc-500">Official source · {d.filename}</span></li>)}</ul><details><summary className="cursor-pointer text-sm underline">All official files &amp; record</summary><ul className="mt-4 space-y-3">{other.map(d=><li key={d.url}><a href={d.url} className="text-sm underline">{d.label}</a></li>)}<li><Source url={publicRecordUrl} className="text-sm underline">Official case record</Source></li>{h.record.events.map(e=><li key={e.id}><Source url={e.sourceUrl} className="text-sm underline">{date(e.date)} · Official hearing record</Source></li>)}</ul></details></section><footer className="border-t border-zinc-200 pt-5 text-xs text-zinc-500 dark:border-zinc-800">Independent summary; official records control. Not affiliated with the applicant or {area.name}.</footer></main>;
}
async function RecordMeetings({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams,feed=await loadFeed(),cases=catalog(feed),id=typeof query.case==="string"?query.case.toUpperCase():undefined;
 const events=allEvents(cases).filter(e=>!id||e.caseIds.includes(id)).reverse();
 return <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-8"><Link href={base} className="text-sm underline">← {area.name}</Link><header className="space-y-3"><h1 className="text-3xl font-semibold">Hearings, agendas &amp; results</h1><p className="text-sm text-zinc-500">Recent and upcoming hearings, plus linked earlier records.{id?" Case: "+id+".":""} For older records, use the official calendar.</p><a href={config.sourceUrl} className="inline-block text-sm underline">Official hearing calendar →</a></header><Warning unavailable={feed.scheduleUnavailable||feed.dataUnavailable} lastUpdated={feed.scheduleRefreshedAt}/>{feed.scheduleUnavailable&&feed.scheduleRefreshedAt&&<p className="text-xs text-zinc-500">Hearing notices last verified: {date(feed.scheduleRefreshedAt)}</p>}<div className="grid gap-4 sm:grid-cols-2">{events.map(event=><MeetingCard key={event.id} event={event} cases={cases}/>)}</div>{!events.length&&<p>No linked hearing found in the collected records. Check the official meeting calendar.</p>}</main>;
}
async function RecordCalendar(_request:Request,{params}:{params:Promise<{planNumber:string}>}){
 const id=(await params).planNumber.toUpperCase(),feed=await loadFeed(),h=catalog(feed).find(c=>c.appId===id) as RecordCase|undefined;
 if(!h)return new Response("Case not found",{status:404});const next=getCaseNextHearing(h,feed,new Date(),area.id);const calendar=next&&hearingCalendar({slug:id,title:titleForCase(h),path:"plan/"+encodeURIComponent(id),areaId:area.id},next);
 return calendar?new Response(calendar,{headers:{"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":'attachment; filename="'+id.toLowerCase()+'-hearing.ics"',"Cache-Control":"no-store"}}):new Response("No confirmed hearing time available",{status:404});
}

return {hub:RecordHub,case:RecordCasePage,caseMetadata:RecordCaseMetadata,meetings:RecordMeetings,caseCalendar:RecordCalendar};
}
