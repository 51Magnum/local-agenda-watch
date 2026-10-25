import {residentialCase,redactResidence,protectMapCase} from "@/lib/residential-privacy";
import {privacyOverrides} from "@/lib/residential-privacy-store";
import { officialProjectRecords, residentPaneHref } from "./project-records";
import { unstable_cache } from "next/cache";
import { getJurisdiction } from "./jurisdictions";
import { readMapSnapshot } from "./store";
import { enrichMapPopups } from "./popup-data";
import { caseCatalog } from "@/lib/case-catalog";
import { getProjectNextHearing, getProjectForCase } from "@/lib/projects";
import { getCaseNextHearing } from "@/lib/case-details";
import {
  readTimelineState,
  buildTimeline,
  TIMELINE_CACHE_TAG,
} from "@/lib/timeline/public";
import { publicFields } from "@/lib/timeline/types";
import {
  projectOverview,
  braeburnOverview,
  factHref,
} from "@/lib/project-overview";
import { landUseFact } from "@/lib/areas/land-use";
import { AREAS, canonicalAreaHref } from "@/lib/areas/registry";
import {
  questionEvidence,
  progressOutcome,
  type PaneData,
} from "./project-questions";
import { MAP_INDEX_TAG, siteMembers } from "./case-index";
import { participationClosed, expiredCommentDeadline } from "@/lib/participation";
import {continuanceHistory} from "@/lib/continuances";

async function detail(
  areaId: string,
  caseId: string,
  followLead = true,
): Promise<PaneData | null> {
  const config = getJurisdiction(areaId),
    area = config?.area;
  if (!config || !area || area.status !== "live") return null;
  const snapshot = await readMapSnapshot(areaId, {
      caseIds: [caseId],
      includeFlum: false,
    }),
    raw = snapshot?.cases[0];
  if (!raw) return null;
  const members = await siteMembers(raw, areaId);
  const lead = members?.[0];
  if (followLead && lead && (lead.areaId !== areaId || lead.caseId !== caseId)) return detail(lead.areaId, lead.caseId, false);
  const project = getProjectForCase(caseId, areaId),
    ids = project?.caseIds ?? [caseId];
  const [items, feed, state] = await Promise.all([
      enrichMapPopups(config, [raw]),
      config.loadCases?.(),
      readTimelineState(ids, areaId),
    ]),
    item = items[0],
    hearing = caseCatalog(feed).find((h) => h.appId === caseId),
    record =
      hearing && !item.citywide && !project?.location
        ? await config.recordForCase?.(hearing)
        : undefined,
    fields = publicFields(state, ids, areaId);
  if (item.popup)
    item.popup = {
      ...item.popup,
      progress: item.popup.progress.map((p) => ({
        ...p,
        label: progressOutcome(p.label),
      })),
    };
  item.members = members;
  item.areaId = areaId;
  item.href = canonicalAreaHref(areaId, item.href);
  const next =
    (project ? getProjectNextHearing(project, feed) : undefined) ??
    (hearing
      ? getCaseNextHearing(hearing, feed, new Date(), areaId)
      : undefined);
  const timeline = buildTimeline(state, {
    areaId,
    caseIds: ids,
    stage:
      item.stage === "Decided"
        ? "Decided"
        : item.stage === "Council/Board"
          ? "Council hearing"
          : item.stage === "P&Z"
            ? "P&Z hearing"
            : "Under review",
    next,
    hearings: hearing ? [hearing] : [],
  });
  const overview = projectOverview(
      timeline,
      project?.slug === "braeburn-creek" ? braeburnOverview : {},
    ),
    evidence = questionEvidence(fields, area),
    landUse = landUseFact(
      area,
      item.flumCategories,
      overview.zoning?.value,
      caseId,
    ),
    impacts: PaneData["impacts"] = [...evidence.impacts];
  if (landUse)
    impacts.unshift({
      label: "Land-use plan",
      value: landUse.value,
      url: landUse.url,
    });
  if (overview.traffic && !impacts.some((i) => i.label === "Traffic"))
    impacts.push({
      label: "Traffic",
      value: overview.traffic.value,
      url: factHref(overview.traffic),
    });
  if (overview.schools && !impacts.some((i) => i.label === "Schools"))
    impacts.push({
      label: "Schools",
      value: overview.schools.value,
      url: factHref(overview.schools),
    });
  const homes = Number(
      overview.homes?.value.match(/^[\d,.]+/)?.[0].replace(/,/g, ""),
    ),
    acres = Number(
      overview.acres?.value.match(/^[\d,.]+/)?.[0].replace(/,/g, ""),
    );
  if (
    homes > 0 &&
    acres > 0 &&
    !item.citywide &&
    overview.homes?.url === overview.acres?.url
  )
    impacts.push({
      label: "Proposed density",
      value: "~" + (homes / acres).toFixed(1) + " homes/acre",
      url: overview.acres?.url,
    });
  const progress = item.popup?.progress ?? [];
  const closed = participationClosed({ ...item, appStatus: hearing?.appStatus });
  const expiredDeadlineMessage = expiredCommentDeadline(next?.commentDeadline, next?.startsAt, next?.body ?? area.bodies.decision.label, area.timezone);
  const officialRecords = officialProjectRecords(
    area,
    caseCatalog(feed).filter((h) => ids.includes(h.appId)),
    record,
    [
      ...(project?.sourceDocuments ?? []).map((d) => ({
        caseIds: d.caseIds,
        url: d.sourceUrl,
      })),
      ...(feed?.agendaMeetings ?? []).flatMap((m) =>
        m.items.map((i) => ({ caseIds: i.caseIds, url: m.sourceUrl })),
      ),
    ],
  );
  const sensitive=residentialCase(areaId,caseId,{hearing,record,item},await privacyOverrides());
  const continuances=continuanceHistory(record?.events ?? (hearing?.meetings??[]).map(m=>({...m,note:m.continuedNote??undefined})),next?.startsAt.slice(0,10));
  const result:PaneData = {
    item,
    officialRecords,
    relatedCases: await Promise.all((item.members??[]).map(async m=>{
      const h=m.areaId===areaId?caseCatalog(feed).find(h=>h.appId===m.caseId):undefined;
      const relatedRecord=h?await config.recordForCase?.(h):undefined;
      return {...m,status:h?.appStatus??m.status,date:m.date??relatedRecord?.decisionDate,label:AREAS[m.areaId]?.name??m.areaId};
    })),
    area: {
      id: area.id,
      name: (area.type === "city" ? "City of " : "") + area.name,
      timezone: area.timezone,
      planningBody: area.bodies.planning.label,
      decisionBody: area.bodies.decision.label,
    },
    caseIds: ids,
    where: item.citywide
      ? "Citywide change — " + area.name
      : (project?.location ?? record?.address),
    history: [
      ...continuances.map(row=>({...row,source:residentPaneHref(area,row.source)})),
      ...progress
        .filter((p) => (p.state === "done" || p.state === "past") && (!continuances.length || !/continued|continuance/i.test(p.label)))
        .map((p) => ({ label: p.label })),
      ...evidence.history.filter(row=>!continuances.length || !/continued|continuance/i.test(row.label)).map((row) => ({
        ...row,
        source: residentPaneHref(area, row.source),
      })),
    ],
    next:
      next && !["Decided", "Recorded"].includes(item.stage)
        ? {
            ...next,
            role:
              next.body === area.bodies.decision.label
                ? "Decision-making body"
                : "Recommendation or hearing; check the official notice for authority",
          }
        : undefined,
    impacts: impacts.map((f) => ({ ...f, url: residentPaneHref(area, f.url) })),
    conditions: evidence.conditions,
    participationClosed: closed,
    expiredDeadlineMessage,
    commentUrl: closed ? undefined : expiredDeadlineMessage ? residentPaneHref(area, next?.sourceUrl) ?? area.residentAccess?.commentUrl ?? area.commentInstructionsUrl : area.residentAccess?.commentUrl ?? area.commentInstructionsUrl,
    commentLinkLabel: area.residentAccess?.commentUrl
      ? "Open meeting portal"
      : "How to comment",
    commentInstructions: closed || expiredDeadlineMessage ? undefined : area.meetingRules.commentInstructions,
    calendarHref:
      !closed && next && next.startsAt.length > 10
        ? item.href + "/hearing.ics"
        : undefined,
    updatedAt:
      Object.values(state.documents)
        .map((d) => d.checkedAt)
        .sort()
        .at(-1) ?? snapshot!.updatedAt,
  };
  if(sensitive){result.item=protectMapCase(areaId,{...result.item,residentialPrivacy:true},await privacyOverrides());result.where=result.where?redactResidence(result.where)+" · Approximate area shown to protect a residential location.":"Approximate residential area; exact address withheld.";return redactResidence(result);}
  return result;
}
export const projectDetail = unstable_cache(
  detail,
  ["map-project-questions-v6"],
  { revalidate: 300, tags: [MAP_INDEX_TAG, TIMELINE_CACHE_TAG] },
);
