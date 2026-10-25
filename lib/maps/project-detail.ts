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
import { canonicalAreaHref } from "@/lib/areas/registry";
import { questionEvidence, type PaneData } from "./project-questions";
import { MAP_INDEX_TAG } from "./case-index";

async function detail(
  areaId: string,
  caseId: string,
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
  return {
    item,
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
      ...progress
        .filter((p) => p.state === "done" || p.state === "past")
        .map((p) => ({ label: p.label })),
      ...evidence.history,
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
    impacts,
    conditions: evidence.conditions,
    commentUrl: area.commentInstructionsUrl,
    commentInstructions: area.meetingRules.commentInstructions,
    calendarHref:
      next && next.startsAt.length > 10
        ? item.href + "/hearing.ics"
        : undefined,
    updatedAt:
      Object.values(state.documents)
        .map((d) => d.checkedAt)
        .sort()
        .at(-1) ?? snapshot!.updatedAt,
  };
}
export const projectDetail = unstable_cache(
  detail,
  ["map-project-questions-v1"],
  { revalidate: 300, tags: [MAP_INDEX_TAG, TIMELINE_CACHE_TAG] },
);
