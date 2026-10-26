import {readProjectContent} from "@/lib/project-content-store";
import { agendaCaseCopy } from "@/lib/agenda-case-copy";
import { cleanResidentTitle } from "@/lib/resident-copy";
import {protectMapCase,residentialCase} from "@/lib/residential-privacy";
import {privacyOverrides} from "@/lib/residential-privacy-store";
import { publicImageReviews, displayedImageReviews } from "./image-review-store";
import { caseCatalog } from "@/lib/case-catalog";
import { getProjectForCase } from "@/lib/projects";
import { publicFields } from "@/lib/timeline/types";
import { readTimelineState } from "@/lib/timeline/public";
import { buildPopupModel, popupApplicationCopy } from "./popup-model";
import type { JurisdictionConfig, MapCase } from "./types";

const fallbackLogs=new Map<string,number>();
/** Batch scoped metadata/fields only; no page text, AI calls, or additional document downloads on map views. */
export async function enrichMapPopups(config: JurisdictionConfig, cases: MapCase[]): Promise<MapCase[]> {
  if (!config.area || !cases.length) return cases;
  const [state, feed, reviews] = await Promise.all([
    readTimelineState([...new Set(cases.flatMap(c => getProjectForCase(c.id, config.id)?.caseIds ?? [c.id]))], config.id),
    config.loadCases?.().catch(() => undefined),
    publicImageReviews(config.id,[...new Set(cases.flatMap(c=>getProjectForCase(c.id,config.id)?.caseIds??[c.id]))]).catch(()=>[]),
  ]);
  const content=await readProjectContent(config.id,cases.map(c=>c.id));
  const catalog = new Map(caseCatalog(feed).map(h => [h.appId, h]));
  const overrides=await privacyOverrides();
  return cases.map(item => {
    const project = getProjectForCase(item.id, config.id);
    const ids = project?.caseIds ?? [item.id];
    const fields = publicFields(state, ids, config.id);
    let hearing = catalog.get(item.id);
    if (hearing && project?.nextHearing) {
      const known = project.nextHearing;
      hearing = { ...hearing, meetings: [...hearing.meetings.filter(m => !(m.date === known.startsAt.slice(0,10) && m.body === known.body)), {
        date: known.startsAt.slice(0,10), time: known.startsAt.slice(11,16), body: known.body, bodyLabel: known.body, dateLabel: known.startsAt.slice(0,10), sourceUrl: known.sourceUrl, continuedNote: null,
      }] };
    }
    if (hearing && project?.pastHearings) hearing = { ...hearing, meetings: [...hearing.meetings, ...project.pastHearings.filter(p => !hearing!.meetings.some(m => m.date === p.date && /planning|P&Z/i.test(m.body))).map(p => ({ date: p.date, dateLabel: p.date, body: config.area!.bodies.planning.id, bodyLabel: config.area!.bodies.planning.label, sourceUrl: p.sourceUrl, continuedNote: null }))] };
    if(hearing && (hearing.decisionRecorded || !item.nextHearing && /^(approved|denied|withdrawn)\b/i.test(hearing.appStatus))) item={...item,stage:item.stage==="Recorded"?"Recorded":"Decided",recordStatus:hearing.appStatus,nextHearing:undefined};
    const popup = buildPopupModel(item, config.area!, hearing, fields);
    // A verified authored project uses its latest application figures, never the older neighborhood notice.
    if (project) {
      popup.projectName = project.name ?? popup.projectName;
      const latest = project.summary.match(/application[^;]*?proposes ([\d,]+) (?:detached )?homes on (?:about )?([\d.]+) acres/i);
      const extractedCopy = popupApplicationCopy(fields);
      const knownSources = project.sourceDocuments?.map(d => d.url.split("#")[0]) ?? [];
      const differentApplication = fields.some(f => f.sourceKind === "staff-report" && ["requestSummary", "units", "acres", "popupHeadline"].includes(f.key) && !knownSources.includes(f.sourceUrl.split("#")[0]));
      if (latest && !differentApplication) {
        if (!extractedCopy.headline) popup.headline = latest[1] + " new homes on " + latest[2] + " acres";
        const applicant = project.summary.match(/([A-Z][\w]+(?: [A-Z][\w]+)*)[’']s? (?:[A-Z][a-z]+ )?application/);
        if (applicant && !extractedCopy.explanation) { popup.explanation = applicant[1] + " wants to add this land to " + config.area!.name + " and build a neighborhood of single-family homes."; popup.aiGenerated = false; }
      }
    }
    const enriched=content[item.id];if(enriched&&(enriched.status==="ready"||!project&&!popup.aiGenerated)){popup.headline=cleanResidentTitle(enriched.headline,item.typeLabel);popup.explanation=enriched.explanation??popup.explanation;popup.aiGenerated=enriched.aiGenerated;}
    const copy=popupApplicationCopy(fields),reviewed=config.reviewedApplications?.[item.id];
    const newer=fields.some(f=>f.sourceKind==="staff-report"&&f.sourceUrl.split("#")[0]!==reviewed?.reportUrl&&f.createdAt.slice(0,10)>(reviewed?.sourceDate??""));
    if(reviewed&&!newer){
      if(!copy.headline)popup.headline=reviewed.headline;
      if(!copy.explanation){popup.explanation=reviewed.explanation;popup.aiGenerated=false;}
    }
    if(!copy.headline||!copy.explanation){
      const key=config.id+":"+item.id;
      if(Date.now()-(fallbackLogs.get(key)??0)>300000){fallbackLogs.set(key,Date.now());console.info("[map-popup:copy-fallback]",JSON.stringify({areaId:config.id,caseId:item.id,missingHeadline:!copy.headline,missingExplanation:!copy.explanation,reason:fields.some(f=>f.sourceKind==="staff-report")?"latest application copy absent or invalid":"no published application extraction",fallback:reviewed&&!newer?"source-reviewed application":project?"authored project or project name":"project name"}));}
      if(fallbackLogs.size>2000)fallbackLogs.clear();
    }
    let visual=displayedImageReviews(reviews).find(r=>r.caseIds.some(id=>ids.includes(id)))?.visual;
    // Physical page 6 was verified against the official report on Oct 25, 2026.
    if(config.id==="nampa"&&item.id==="DAMO-00068-2026"&&visual?.sourceUrl.includes("692e24e4-3deb-43d0-8609-530cf87e180c")&&visual.sourceUrl.endsWith("#page=6")&&visual.approval?.pageHash==="00093c24e7c1eba3e02473ac2a23b8b5b026fe565f854d93eb11d3ec45723a89")visual={...visual,label:"Zoning and future land-use maps",alt:"Zoning and future land-use context maps; not a proposed layout",kind:"context"};
    if(visual&&reviewed&&visual.sourceUrl.split("#")[0]===reviewed.reportUrl&&!visual.approval?.sourceDate)visual={...visual,label:visual.label+" · "+new Intl.DateTimeFormat("en-US",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(reviewed.sourceDate+"T12:00:00Z"))};
    const agenda = agendaCaseCopy(feed,item.id,config.area!.timezone);
    if (agenda) {
      popup.projectName=agenda.name;popup.headline=agenda.headline;popup.explanation=agenda.explanation;popup.aiGenerated=false;
      item={...item,title:agenda.name,summary:agenda.explanation};
    }
    return protectMapCase(config.id,{...item,popup,visual,residentialPrivacy:residentialCase(config.id,item.id,{item,hearing},overrides)},overrides);
  });
}
