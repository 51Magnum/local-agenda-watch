import { caseCatalog } from "@/lib/case-catalog";
import { getProjectForCase } from "@/lib/projects";
import { publicFields } from "@/lib/timeline/types";
import { readTimelineState } from "@/lib/timeline/public";
import { buildPopupModel, popupApplicationCopy } from "./popup-model";
import type { JurisdictionConfig, MapCase } from "./types";

/** Batch scoped metadata/fields only; no page text, AI calls, or additional document downloads on map views. */
export async function enrichMapPopups(config: JurisdictionConfig, cases: MapCase[]): Promise<MapCase[]> {
  if (!config.area || !cases.length) return cases;
  const [state, feed] = await Promise.all([
    readTimelineState([...new Set(cases.flatMap(c => getProjectForCase(c.id, config.id)?.caseIds ?? [c.id]))], config.id),
    config.loadCases?.().catch(() => undefined),
  ]);
  const catalog = new Map(caseCatalog(feed).map(h => [h.appId, h]));
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
    const popup = buildPopupModel(item, config.area!, hearing, fields);
    // A verified authored project uses its latest application figures, never the older neighborhood notice.
    if (project) {
      popup.projectName = project.name ?? popup.projectName;
      const latest = project.summary.match(/application proposes ([\d,]+) (?:detached )?homes on (?:about )?([\d.]+) acres/i);
      const extractedCopy = popupApplicationCopy(fields);
      const knownSources = project.sourceDocuments?.map(d => d.url.split("#")[0]) ?? [];
      const differentApplication = fields.some(f => f.sourceKind === "staff-report" && ["requestSummary", "units", "acres", "popupHeadline"].includes(f.key) && !knownSources.includes(f.sourceUrl.split("#")[0]));
      if (latest && !differentApplication) {
        if (!extractedCopy.headline) popup.headline = latest[1] + " new homes on " + latest[2] + " acres";
        const applicant = project.summary.match(/([A-Z][\w]+(?: [A-Z][\w]+)*)[’']s? [A-Z][a-z]+ application/);
        if (applicant && !extractedCopy.explanation) { popup.explanation = applicant[1] + " wants to add this land to " + config.area!.name + " and build a neighborhood of single-family homes."; popup.aiGenerated = false; }
      }
    }
    return { ...item, popup };
  });
}
