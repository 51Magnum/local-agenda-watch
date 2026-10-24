import { residentHref } from "@/lib/areas/record-links";
import{displayArea}from"@/lib/areas/format";
import{stageLabel}from"@/lib/areas/registry";
import type { LandUseFact } from "@/lib/areas/land-use";
import { Glossary } from "./glossary";
import { factHref, numericFact, projectDensity, type ProjectOverview, type SourcedFact } from "@/lib/project-overview";
import type { TimelineData } from "@/lib/timeline/public";
import { latestField } from "@/lib/timeline/public";
import { projectTimelineRows } from "@/lib/project-timeline";
import { evidenceSourceHref } from "@/lib/timeline/types";
function FactSource({ fact, label }: { fact: SourcedFact; label: string }) {
  if (!residentHref(factHref(fact))) return null;
  return <a href={factHref(fact)} aria-label={"Source for "+label+(fact.page?", page "+fact.page:"")} title={fact.page?"Source · page "+fact.page:"Official source"} className="ml-2 shrink-0 text-xs text-zinc-500 underline underline-offset-4">↗</a>;
}
export function ProjectFacts({ overview, landUse }: { overview: ProjectOverview; landUse?: SourcedFact & Partial<LandUseFact> }) {
  const homes=numericFact(overview.homes),acres=numericFact(overview.acres),density=projectDensity(overview);
  const residential=[homes&&overview.homes?{label:"Homes / lots",value:homes.toLocaleString("en-US"),source:overview.homes}:null,acres&&overview.acres?{label:"Acres",value:Math.round(acres).toLocaleString("en-US"),source:overview.acres}:null,density&&overview.acres?{label:"Density overall",value:density,source:overview.acres}:null].filter(x=>x!==null);
  const acreage=acres&&overview.acres?{label:"Site acres",value:Number(acres.toFixed(2)).toLocaleString("en-US"),source:overview.acres}:null;
  const primary=overview.variant==="subdivision"?[overview.homes?{label:"Lots",value:overview.homes.value,source:overview.homes}:null,acreage].filter(x=>x!==null):overview.variant==="zoning"?[overview.request?{label:"Request",value:overview.request.value,source:overview.request}:null,acreage,overview.zoning?{label:"Requested zoning",value:overview.zoning.value,source:overview.zoning}:null].filter(x=>x!==null):overview.variant==="nonresidential"?[overview.use?{label:"Proposed use",value:overview.use.value,source:overview.use}:overview.request?{label:"Request",value:overview.request.value,source:overview.request}:null,acreage,overview.buildingArea?{label:"Building area",value:overview.buildingArea.value,source:overview.buildingArea}:null].filter(x=>x!==null):overview.variant==="mixed-use"?[residential[0],overview.buildingArea?{label:"Commercial floor area",value:overview.buildingArea.value,source:overview.buildingArea}:null,acreage].filter(x=>x!=null):residential;
  const secondary=[overview.variant!=="zoning"&&overview.zoning?{label:"Requested zoning",fact:overview.zoning}:null,overview.variant==="zoning"&&overview.currentJurisdiction?{label:"Current jurisdiction",fact:overview.currentJurisdiction}:null,landUse?{label:"Future land use",fact:landUse}:null,overview.applicant?{label:"Applicant",fact:overview.applicant}:null].filter(x=>x!==null);
  if(!primary.length&&!secondary.length)return null;
  const sources = new Map<string, string[]>();
  for (const entry of [...primary.map(f=>({label:f.label,fact:f.source})),...secondary]) {
    const href=residentHref(factHref(entry.fact)); if (!href) continue; const labels=sources.get(href)??[];
    labels.push(entry.label+(entry.fact.page?" (page "+entry.fact.page+")":"")); sources.set(href,labels);
  }
  if(residentHref(landUse?.comparisonSourceUrl))sources.set(landUse!.comparisonSourceUrl!,["Plan / zoning district comparison"]);
  return <section aria-label="Key project facts" className="space-y-5">
    {!!primary.length&&<dl className={"grid gap-3 "+(primary.length===1?"sm:grid-cols-1":primary.length===2?"sm:grid-cols-2":"sm:grid-cols-3")}>{primary.map(f=><div key={f.label} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"><dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{f.label}</dt><dd className="mt-2 text-2xl font-semibold tracking-tight">{f.value}</dd></div>)}</dl>}
    {!!secondary.length&&<dl className="grid gap-5 text-sm sm:grid-cols-3">{secondary.map(f=><div key={f.label}><dt className="text-zinc-500">{f.label}</dt><dd className="mt-1 font-medium leading-6">{f.label==="Future land use"&&landUse?.mapHref?<a href={landUse.mapHref} className="underline underline-offset-4">{f.fact.value}</a>:f.fact.value}</dd></div>)}</dl>}
    <details className="text-xs text-zinc-500"><summary className="w-fit cursor-pointer underline underline-offset-4">Sources</summary><ul className="mt-3 space-y-2">{[...sources].map(([href,labels])=><li key={href}><a href={href} className="underline underline-offset-4">{labels.join(" · ")}</a></li>)}</ul></details>
  </section>;
}
export function ProjectProposal({ overview, data, terms = ["annexation", "rezone", "preliminary plat"], areaId }: { overview: ProjectOverview; data: TimelineData; terms?: ("annexation" | "rezone" | "preliminary plat")[]; areaId?: string }) {
  const area=displayArea(areaId);
  const conditions=latestField(data.fields.filter(f=>f.status==="approved"&&["pz-decision","minutes"].includes(f.sourceKind)),"pzConditions");
  const list=conditions?.value.split(/\n+/).map(x=>x.replace(/^\s*(?:[-•]|\d+[.)])\s*/,"").trim()).filter(Boolean)??[];
  if(!overview.summary&&!overview.traffic&&!overview.schools&&!overview.recommendation&&!conditions)return null;
  return <section aria-labelledby="whats-proposed-title" className="space-y-5">
    <h2 id="whats-proposed-title" className="text-2xl font-semibold">What’s proposed</h2>
    {overview.summary&&<p className="max-w-3xl leading-8 text-zinc-700 dark:text-zinc-300">{overview.summary}{overview.summarySource&&<FactSource fact={overview.summarySource} label="proposal summary"/>}</p>}
    {overview.earlierNotice&&<p className="text-sm text-zinc-500">{overview.earlierNotice}</p>}
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm leading-7 text-zinc-500">{terms.map(term=><span key={term}><Glossary term={term}/>{term==="annexation"?" brings land into city limits.":term==="rezone"?" sets permitted uses.":" lays out lots and streets."}</span>)}</p>
    {(overview.traffic||overview.schools||overview.recommendation||conditions)&&<div className="space-y-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      {overview.recommendation&&<div><h3 className="font-semibold">Staff recommendation<FactSource fact={overview.recommendation} label="staff recommendation"/></h3><p className="mt-1 text-sm leading-7">{overview.recommendation.value}</p></div>}
      {overview.traffic&&<div><h3 className="font-semibold">Traffic<FactSource fact={overview.traffic} label="traffic"/></h3><p className="mt-1 text-sm leading-7">{overview.traffic.value}</p></div>}
      {overview.schools&&<div><h3 className="font-semibold">Schools<FactSource fact={overview.schools} label="schools"/></h3><p className="mt-1 text-sm leading-7">{overview.schools.value}</p></div>}
      {!!list.length&&conditions&&<div><h3 className="font-semibold">{area.bodies.planning.shortLabel} recommended conditions <a href={evidenceSourceHref(conditions)} className="ml-2 text-xs font-normal underline">Source</a></h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-7">{list.slice(0,5).map((x,i)=><li key={i}>{x}</li>)}</ul>{list.length>5&&<details className="mt-3 text-sm"><summary className="cursor-pointer underline">Show all {list.length} conditions</summary><ul className="mt-3 list-disc space-y-2 pl-5 leading-7">{list.slice(5).map((x,i)=><li key={i}>{x}</li>)}</ul></details>}</div>}
    </div>}
  </section>;
}
export function ProjectTimeline({ data, areaId }: { data: TimelineData; areaId?: string }) {
  const area=displayArea(areaId);
  const rows=projectTimelineRows(data);if(!rows.length)return null;
  return <section aria-labelledby="timeline-title" className="space-y-6"><h2 id="timeline-title" className="text-2xl font-semibold">Project timeline</h2><ol aria-label="Project timeline" className="border-l-2 border-zinc-200 pl-6 dark:border-zinc-800">{rows.map((row,i)=><li key={row.stage+i} aria-current={row.stage===data.currentStage?"step":undefined} className="relative pb-7 last:pb-0"><span aria-hidden="true" className={"absolute -left-[31px] top-1 h-3 w-3 rounded-full "+(row.stage===data.currentStage?"bg-sky-500":"bg-zinc-300 dark:bg-zinc-600")}/><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{row.stage==="P&Z hearing"?<Glossary term="P&Z" areaId={area.id}>{area.bodies.planning.stageLabel}</Glossary>:stageLabel(row.stage,area)}</h3>{row.sources && row.sources.length > 1 ? <details className="text-xs text-zinc-500"><summary className="cursor-pointer underline underline-offset-4">Sources</summary><ul className="mt-2 space-y-2">{row.sources.map((url,i)=><li key={url}><a href={url} className="underline">{i===0?"Decision record":"Supporting record"}</a></li>)}</ul></details> : row.source&&<a href={row.source} className="text-xs text-zinc-500 underline underline-offset-4">Source</a>}</div><p className="mt-1 text-sm leading-7">{row.text}</p>{row.caseIds&&<p className="text-xs text-zinc-500">{row.caseIds.join(" · ")}</p>}{row.vote&&<p className="text-sm text-zinc-500">Vote: {row.vote}</p>}{(row.support!==undefined||row.opposition!==undefined)&&<p className="text-sm text-zinc-500">Speakers: {[row.support!==undefined?row.support+" in support":undefined,row.opposition!==undefined?row.opposition+" opposed":undefined].filter(Boolean).join(" · ")}</p>}</li>)}</ol></section>;
}
