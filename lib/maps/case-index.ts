import { Pool } from "pg";
import { bbox, simplify, feature } from "@turf/turf";
import { unstable_cache, revalidateTag } from "next/cache";
import { AREAS, canonicalAreaHref } from "@/lib/areas/registry";
import { readMapSnapshot } from "./store";
import { combineRadiusCases } from "./radius";
import { trackedRows } from "@/lib/db-transfer";
import type { MapCase, MapSnapshot } from "./types";
import {
  bufferedBounds,
  caseInFilter,
  type Bounds,
  type MapSummary,
  type ViewportData,
} from "./viewport";
export const MAP_INDEX_TAG = "map-case-index-v1";
let pool: Pool, ready: Promise<void> | undefined;
const schema = `CREATE TABLE IF NOT EXISTS law_map_cases(area_id text NOT NULL,case_id text NOT NULL,min_lng double precision,min_lat double precision,max_lng double precision,max_lat double precision,lng double precision,lat double precision,data jsonb NOT NULL,PRIMARY KEY(area_id,case_id));
CREATE INDEX IF NOT EXISTS law_map_cases_centroid ON law_map_cases(lng,lat);
CREATE INDEX IF NOT EXISTS law_map_cases_bbox ON law_map_cases(min_lng,max_lng,min_lat,max_lat);
CREATE TABLE IF NOT EXISTS law_map_index_meta(id text PRIMARY KEY,updated_at timestamptz NOT NULL);
INSERT INTO law_map_cases SELECT jurisdiction,c->>'id',(b->>0)::float,(b->>1)::float,(b->>2)::float,(b->>3)::float,(c->'centroid'->>0)::float,(c->'centroid'->>1)::float,c||jsonb_build_object('bounds',b) FROM law_map_cache,jsonb_array_elements(snapshot->'cases') c CROSS JOIN LATERAL(SELECT coalesce(nullif(c->'bounds','null'::jsonb),(SELECT jsonb_build_array(min((p->>0)::float),min((p->>1)::float),max((p->>0)::float),max((p->>1)::float)) FROM jsonb_path_query(c->'geometry','$.coordinates.** ? (@.type() == "array")')p WHERE jsonb_typeof(p->0)='number' AND jsonb_typeof(p->1)='number')) AS b)bounds WHERE NOT EXISTS(SELECT 1 FROM law_map_index_meta WHERE id='seed-v1') ON CONFLICT DO NOTHING;
INSERT INTO law_map_index_meta VALUES('seed-v1',now()) ON CONFLICT DO NOTHING;`;
export function indexedDecisionDate(h: {
  meetings: { date: string; body: string; result?: string }[];
  county?: { decisionDate?: string };
  record?: { decisionDate?: string };
}) {
  return (
    h.meetings
      .filter(
        (m) =>
          /council|board/i.test(m.body) &&
          /^(approved|denied)/i.test(m.result ?? ""),
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ??
    h.county?.decisionDate ??
    h.record?.decisionDate
  );
}
async function indexQuery(sql: string, values?: unknown[]) {
  const result = await pool.query(sql, values);
  trackedRows("map-index", result.rows ?? []);
  return result;
}
async function database() {
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
  ready ??= indexQuery(schema)
    .then(async () => {
      const done = await indexQuery(
        "SELECT 1 FROM law_map_index_meta WHERE id='dates-v1'",
      );
      if (done.rows.length) return;
      const { JURISDICTIONS } = await import("./jurisdictions");
      const { caseCatalog } = await import("@/lib/case-catalog");
      const results = await Promise.allSettled(
        Object.values(JURISDICTIONS)
          .filter((c) => c.area?.status === "live")
          .map(async (c) => {
            const feed = await c.loadCases?.();
            const dates = caseCatalog(feed).flatMap((h) => {
              const date = indexedDecisionDate(h);
              return date ? [{ id: h.appId, date }] : [];
            });
            if (dates.length)
              await indexQuery(
                "UPDATE law_map_cases c SET data=jsonb_set(c.data,'{decisionDate}',x->'date') FROM jsonb_array_elements($2::jsonb)x WHERE c.area_id=$1 AND c.case_id=x->>'id'",
                [c.id, JSON.stringify(dates)],
              );
          }),
      );
      if (results.every((r) => r.status === "fulfilled"))
        await indexQuery(
          "INSERT INTO law_map_index_meta VALUES('dates-v1',now()) ON CONFLICT DO NOTHING",
        );
    })
    .catch((e) => {
      ready = undefined;
      throw e;
    });
  await ready;
  return { query: indexQuery };
}
export async function syncCaseIndex(snapshot: MapSnapshot) {
  if (!process.env.DATABASE_URL) return;
  const db = await database();
  const rows = snapshot.cases.map((c) => {
    const b = c.geometry ? (c.bounds ?? bbox(c.geometry)) : null;
    return {
      id: c.id,
      b,
      lng: c.centroid?.[0],
      lat: c.centroid?.[1],
      data: { ...c, bounds: b ?? undefined, decisionDate: c.decisionDate },
    };
  });
  await db.query(
    `INSERT INTO law_map_cases SELECT $1,x->>'id',(x->'b'->>0)::float,(x->'b'->>1)::float,(x->'b'->>2)::float,(x->'b'->>3)::float,(x->>'lng')::float,(x->>'lat')::float,x->'data' FROM jsonb_array_elements($2::jsonb)x ON CONFLICT(area_id,case_id) DO UPDATE SET min_lng=excluded.min_lng,min_lat=excluded.min_lat,max_lng=excluded.max_lng,max_lat=excluded.max_lat,lng=excluded.lng,lat=excluded.lat,data=excluded.data WHERE law_map_cases.data IS DISTINCT FROM excluded.data`,
    [snapshot.jurisdiction, JSON.stringify(rows)],
  );
  await db.query(
    "DELETE FROM law_map_cases WHERE area_id=$1 AND NOT(case_id=ANY($2::text[]))",
    [snapshot.jurisdiction, rows.map((r) => r.id)],
  );
  await db.query(
    "INSERT INTO law_map_index_meta VALUES($1,now()) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at",
    [snapshot.jurisdiction],
  );
  if (process.env.NEXT_RUNTIME && process.env.NODE_ENV !== "test")
    revalidateTag(MAP_INDEX_TAG, { expire: 0 });
}
function publicFeature(c: MapCase, areaId: string, zoom: number): MapCase {
  let geometry = c.geometry;
  if (geometry && zoom >= 14)
    try {
      geometry = simplify(feature(geometry), {
        tolerance: 360 / 2 ** (zoom + 10),
        highQuality: false,
      }).geometry;
    } catch {}
  return {
    id: c.id.includes(":") ? c.id : areaId + ":" + c.id,
    areaId,
    timezone: AREAS[areaId]?.timezone,
    uses: ["homes", "business"].filter((f) => caseInFilter(c, f)),
    popup: c.popup
      ? {
          headline: c.popup.headline,
          projectName: c.popup.projectName,
          progress: [],
        }
      : undefined,
    members: c.members,
    caseIds: c.caseIds,
    jurisdictionLabel: c.jurisdictionLabel,
    title: c.title,
    summary: "",
    type: c.type,
    typeLabel: c.typeLabel,
    stage: c.stage,
    stageBody: c.stageBody,
    nextHearing: c.nextHearing,
    decisionDate: c.decisionDate,
    href: canonicalAreaHref(areaId, c.href),
    geometry: zoom >= 14 ? geometry : null,
    centroid: c.centroid,
    bounds: c.bounds,
    source: c.source,
    confidence: c.confidence,
    citywide: c.citywide,
    flumCategories: [],
    parcelIds: c.parcelIds,
    parcelNamespace: c.parcelNamespace,
  };
}
async function loadViewport(
  bounds: Bounds,
  zoom: number,
): Promise<ViewportData> {
  const areas = Object.values(AREAS).filter((a) => a.status === "live"),
    b = bufferedBounds(bounds);
  let rows: { area_id: string; data: MapCase }[] = [];
  if (process.env.DATABASE_URL) {
    const db = await database();
    if (zoom >= 9)
      rows = (
        await db.query(
          `SELECT area_id,data-'visual'-'popup' AS data FROM law_map_cases WHERE area_id=ANY($6::text[]) AND min_lng<=$3 AND max_lng>=$1 AND min_lat<=$4 AND max_lat>=$2 AND $5::int>=9 AND NOT coalesce((data->>'citywide')::boolean,false) ORDER BY area_id,case_id LIMIT 1001`,
          [...b, zoom, areas.map((a) => a.id)],
        )
      ).rows;
  } else if (zoom >= 9)
    for (const a of areas) {
      const s = await readMapSnapshot(a.id, { bounds: b, includeFlum: false });
      rows.push(
        ...(s?.cases ?? [])
          .filter((c) => !c.citywide)
          .map((data) => ({ area_id: a.id, data })),
      );
    }
  const summaries =
    zoom < 9
      ? (await mapManifest()).summaries.filter(
          (a) =>
            a.bounds[0] <= b[2] &&
            a.bounds[2] >= b[0] &&
            a.bounds[1] <= b[3] &&
            a.bounds[3] >= b[1],
        )
      : [];
  const grouped = combineRadiusCases(
    areas.map((area) => ({
      area,
      cases: rows.filter((r) => r.area_id === area.id).map((r) => r.data),
    })),
    [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2],
    25000,
  );
  // Lightweight public extraction metadata is cached with the viewport; no images, source feeds or page text are loaded here.
  const [
    { readTimelineState },
    { publicFields },
    { popupApplicationCopy },
    { getProjectForCase },
    { JURISDICTIONS },
  ] = await Promise.all([
    import("@/lib/timeline/public"),
    import("@/lib/timeline/types"),
    import("./popup-model"),
    import("@/lib/projects"),
    import("./jurisdictions"),
  ]);
  if (zoom >= 9)
    await Promise.all(
      areas.map(async (a) => {
        const matches = grouped.filter((c) => c.areaId === a.id);
        if (!matches.length) return;
        const ids = [
          ...new Set(
            matches.flatMap((c) => c.caseIds ?? [c.id.split(":").at(-1)!]),
          ),
        ];
        const state = await readTimelineState(ids, a.id);
        for (const c of matches) {
          const id = c.members?.[0]?.caseId ?? c.id.split(":").at(-1)!,
            project = getProjectForCase(id, a.id),
            fields = publicFields(state, project?.caseIds ?? [id], a.id),
            copy = popupApplicationCopy(fields);
          c.popup = {
            headline:
              copy.headline ??
              JURISDICTIONS[a.id]?.reviewedApplications?.[id]?.headline ??
              project?.name ??
              c.title,
            projectName: project?.name ?? c.title,
            progress: [],
          };
        }
      }),
    );
  return {
    cases: grouped.slice(0, 1000).map((c) => publicFeature(c, c.areaId!, zoom)),
    summaries,
    truncated: rows.length > 1000,
    updatedAt: new Date().toISOString(),
    bounds: b,
  };
}
export const cachedViewport = unstable_cache(
  loadViewport,
  ["viewport-cases-v1"],
  { revalidate: 3600, tags: [MAP_INDEX_TAG] },
);
async function manifest() {
  let counts: { area_id: string; count: number; upcoming: number }[] = [],
    revision = "local";
  if (process.env.DATABASE_URL) {
    const db = await database();
    counts = (
      await db.query(
        `SELECT area_id,count(*) FILTER(WHERE data->>'stage' NOT IN ('Decided','Recorded'))::int AS count,count(*) FILTER(WHERE data->'nextHearing'->>'date'>=CURRENT_DATE::text)::int AS upcoming FROM law_map_cases GROUP BY area_id`,
      )
    ).rows;
    revision =
      (
        await db.query(
          "SELECT max(updated_at)::text AS revision FROM law_map_index_meta",
        )
      ).rows[0]?.revision ?? "initial";
  } else
    for (const a of Object.values(AREAS).filter((a) => a.status === "live")) {
      const s = await readMapSnapshot(a.id, { includeFlum: false });
      counts.push({
        area_id: a.id,
        count:
          s?.cases.filter((c) => !["Decided", "Recorded"].includes(c.stage))
            .length ?? 0,
        upcoming:
          s?.cases.filter(
            (c) =>
              c.nextHearing &&
              c.nextHearing.date >= new Date().toISOString().slice(0, 10),
          ).length ?? 0,
      });
    }
  const summaries: MapSummary[] = Object.values(AREAS)
    .filter((a) => a.status === "live")
    .map((a) => ({
      id: a.id,
      name: a.name,
      center: a.center,
      bounds: bbox(a.boundary).slice(0, 4) as Bounds,
      count: counts.find((c) => c.area_id === a.id)?.count ?? 0,
      upcoming: counts.find((c) => c.area_id === a.id)?.upcoming ?? 0,
    }));
  return {
    revision,
    summaries,
    areas: Object.values(AREAS).map((a) => ({
      id: a.id,
      name: a.name,
      stateAbbreviation: a.stateAbbreviation,
      href: "/" + [a.country, a.state, a.slug].join("/"),
      center: a.center,
      bounds: bbox(a.boundary).slice(0, 4),
      status: a.status,
    })),
  };
}
export const mapManifest = unstable_cache(manifest, ["map-manifest-v1"], {
  revalidate: 3600,
  tags: [MAP_INDEX_TAG],
});
