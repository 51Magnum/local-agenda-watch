import {databaseUrl} from "../runtime-environment";
import {siteReviewAreaIds} from "../jurisdictions/generated";
import {readProjectContent} from "@/lib/project-content-store";
import {getProjectForCase} from "@/lib/projects";
import {cleanResidentTitle} from "@/lib/resident-copy";
import {residentialCase,protectMapCase,residentialPublicTitle,PRIVACY_TAG} from "@/lib/residential-privacy";
import {privacyOverrides} from "@/lib/residential-privacy-store";
import { Pool } from "../database-pool";
import { bbox, simplify, feature } from "@turf/turf";
import { unstable_cache, revalidateTag } from "next/cache";
import { AREAS, canonicalAreaHref } from "@/lib/areas/registry";
import { readMapSnapshot } from "./store";
import { combineRadiusCases } from "./radius";
import {productionWritesAllowed,requireProductionMutation} from "../runtime-environment";
import { trackedRows } from "@/lib/db-transfer";
import type { MapCase, MapSnapshot } from "./types";
import {
  CASE_OUTLINE_ZOOM,
  caseInFilter,
  type Bounds,
  type MapSummary,
  type ViewportData,
} from "./viewport";
export const MAP_INDEX_TAG = "map-case-index-v1";
const reviewCacheKeys=siteReviewAreaIds.length?["resident-review:"+siteReviewAreaIds.join(",")+":"+(process.env.VERCEL_GIT_COMMIT_SHA??"local")]:[];
const reviewSnapshots=()=>Promise.all(siteReviewAreaIds.map(id=>readMapSnapshot(id,{includeFlum:false})));
/** Compact, cached directory: never read polygon, image or document payloads for search. */
export const projectDirectory = unstable_cache(async () => {
  const areas = Object.values(AREAS).filter((a) => a.status === "live");
  if (!databaseUrl()) return [];
  const db = await database();
  const result = await db.query(
    `SELECT area_id AS "areaId",case_id AS "caseId",data->>'title' AS title,data->>'typeLabel' AS "typeLabel",data->'caseIds' AS "caseIds",data->>'summary' AS "internalSummary",data->'residentialPrivacy' AS "residentialPrivacy" FROM law_map_cases WHERE area_id=ANY($1::text[]) ORDER BY area_id,case_id`,
    [areas.map((a) => a.id)],
  );
  for(const snapshot of await reviewSnapshots())for(const c of snapshot?.cases??[])result.rows.push({areaId:snapshot!.jurisdiction,caseId:c.id,title:c.title,typeLabel:c.typeLabel,caseIds:[c.id],internalSummary:c.summary,residentialPrivacy:c.residentialPrivacy});
  const overrides=await privacyOverrides();
  return result.rows.map(({internalSummary,...row}) => ({ ...row, title:residentialCase(row.areaId,row.caseId,{...row,summary:internalSummary},overrides)?residentialPublicTitle({...row,summary:internalSummary}):row.title, areaName: AREAS[row.areaId].name })) as import("./project-search").ProjectMatch[];
}, ["project-search-directory-v2-private-names",...reviewCacheKeys], { revalidate: 3600, tags: [MAP_INDEX_TAG, PRIVACY_TAG] });
let pool: Pool, ready: Promise<void> | undefined;
const schema = `CREATE TABLE IF NOT EXISTS law_map_sites(site_id text PRIMARY KEY,min_lng double precision,min_lat double precision,max_lng double precision,max_lat double precision,data jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS law_map_sites_bbox ON law_map_sites(min_lng,max_lng,min_lat,max_lat);
CREATE TABLE IF NOT EXISTS law_map_cases(area_id text NOT NULL,case_id text NOT NULL,min_lng double precision,min_lat double precision,max_lng double precision,max_lat double precision,lng double precision,lat double precision,data jsonb NOT NULL,PRIMARY KEY(area_id,case_id));
CREATE INDEX IF NOT EXISTS law_map_cases_centroid ON law_map_cases(lng,lat);
CREATE INDEX IF NOT EXISTS law_map_cases_bbox ON law_map_cases(min_lng,max_lng,min_lat,max_lat);
CREATE TABLE IF NOT EXISTS law_map_index_meta(id text PRIMARY KEY,updated_at timestamptz NOT NULL);
INSERT INTO law_map_cases SELECT jurisdiction,c->>'id',(b->>0)::float,(b->>1)::float,(b->>2)::float,(b->>3)::float,(c->'centroid'->>0)::float,(c->'centroid'->>1)::float,c||jsonb_build_object('bounds',b) FROM law_map_cache,jsonb_array_elements(snapshot->'cases') c CROSS JOIN LATERAL(SELECT coalesce(nullif(c->'bounds','null'::jsonb),(SELECT jsonb_build_array(min((p->>0)::float),min((p->>1)::float),max((p->>0)::float),max((p->>1)::float)) FROM jsonb_path_query(c->'geometry','$.coordinates.** ? (@.type() == "array")')p WHERE jsonb_typeof(p->0)='number' AND jsonb_typeof(p->1)='number')) AS b)bounds WHERE NOT EXISTS(SELECT 1 FROM law_map_index_meta WHERE id='seed-v1') ON CONFLICT DO NOTHING;
INSERT INTO law_map_index_meta VALUES('seed-v1',now()) ON CONFLICT DO NOTHING;`;
export function indexedDecisionDate(h: {
  meetings: { date: string; body: string; result?: string }[];
  meridian?: {authority:string;action:string;actionDate?:string};
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
    (h.meridian?.authority==="City Council"&&/^(approved|denied)$/i.test(h.meridian.action)?h.meridian.actionDate:undefined) ??
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
    connectionString: databaseUrl(),
    max: 2,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
  if(!productionWritesAllowed())return {query:indexQuery};
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
let sitesReady:Promise<void>|undefined;
let siteRebuild:Promise<void>|undefined,sitesDirty=false;
function rebuildSites(){sitesDirty=true;return siteRebuild??=(async()=>{try{while(sitesDirty){sitesDirty=false;await rebuildSitesOnce();}}finally{siteRebuild=undefined;}})();}
async function rebuildSitesOnce(){
 requireProductionMutation();
 const rows=(await indexQuery("SELECT area_id,data-'visual' AS data FROM law_map_cases WHERE area_id=ANY($1::text[])",[Object.values(AREAS).filter(a=>a.status==="live").map(a=>a.id)])).rows;
 const areas=Object.values(AREAS).filter(a=>a.status==="live");
 await Promise.all(areas.map(async area=>{const matches=rows.filter(r=>r.area_id===area.id),content=await readProjectContent(area.id,matches.map(r=>r.data.id));for(const r of matches){const c=r.data,project=getProjectForCase(c.id,area.id);c.popup={headline:content[c.id]?.headline??c.popup?.headline??project?.name??cleanResidentTitle(c.title),projectName:project?.name??cleanResidentTitle(c.title),progress:[]};}}));
 const sites=combineRadiusCases(Object.values(AREAS).filter(a=>a.status==="live").map(area=>({area,cases:rows.filter(r=>r.area_id===area.id).map(r=>r.data)})),[0,0],25000);
 const payload=sites.map(data=>({data,b:data.geometry?bbox(data.geometry):data.bounds??[...data.centroid!,...data.centroid!]}));
 await indexQuery(`WITH rows AS(SELECT x->'data' AS data,x->'b' AS b FROM jsonb_array_elements($1::jsonb)x), written AS(INSERT INTO law_map_sites SELECT data->>'id',(b->>0)::float,(b->>1)::float,(b->>2)::float,(b->>3)::float,data FROM rows ON CONFLICT(site_id) DO UPDATE SET min_lng=excluded.min_lng,min_lat=excluded.min_lat,max_lng=excluded.max_lng,max_lat=excluded.max_lat,data=excluded.data RETURNING site_id) DELETE FROM law_map_sites WHERE site_id NOT IN(SELECT data->>'id' FROM rows)`,[JSON.stringify(payload)]);
 await indexQuery("INSERT INTO law_map_index_meta VALUES('sites-headlines-v2',now()) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at");
}
async function ensureSites(){await database();if(!productionWritesAllowed())return;sitesReady??=(async()=>{if(!(await indexQuery("SELECT 1 FROM law_map_index_meta WHERE id='sites-headlines-v2'")).rows.length)await rebuildSites();})().catch(e=>{sitesReady=undefined;throw e;});await sitesReady;}
export async function syncCaseIndex(snapshot: MapSnapshot) {
  requireProductionMutation();
  if (!databaseUrl()) return;
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
  await rebuildSites();
  if (process.env.NEXT_RUNTIME && process.env.NODE_ENV !== "test")
    {revalidateTag(MAP_INDEX_TAG, { expire: 0 });revalidateTag("map-area:"+snapshot.jurisdiction,{expire:0});}
}
function publicFeature(c: MapCase, areaId: string, zoom: number): MapCase {
  let geometry = c.geometry;
  if (geometry && zoom >= CASE_OUTLINE_ZOOM)
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
    geometry: zoom >= CASE_OUTLINE_ZOOM ? geometry : null,
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
    b = bounds;
  let rows: { area_id: string; data: MapCase }[] = [];
  if (databaseUrl()) {
    await ensureSites();const db = await database();
    if (zoom >= 9)
      rows = (
        await db.query(
          `SELECT data->>'areaId' AS area_id,CASE WHEN $5::int<$7::int THEN data-'visual'-'geometry' ELSE data-'visual' END AS data FROM law_map_sites WHERE data->>'areaId'=ANY($6::text[]) AND min_lng<=$3 AND max_lng>=$1 AND min_lat<=$4 AND max_lat>=$2 AND $5::int>=9 AND NOT coalesce((data->>'citywide')::boolean,false) ORDER BY site_id LIMIT 1001`,
          [...b, zoom, areas.map((a) => a.id), CASE_OUTLINE_ZOOM],
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
  const overrides = await privacyOverrides();
  const grouped = databaseUrl()?rows.map(r=>r.data):combineRadiusCases(areas.map(area=>({area,cases:rows.filter(r=>r.area_id===area.id).map(r=>r.data)})),[(b[0]+b[2])/2,(b[1]+b[3])/2],25000);
  if(zoom>=9)for(const snapshot of await reviewSnapshots())for(const c of snapshot?.cases??[]){const box=c.bounds;if(box&&box[0]<=b[2]&&box[2]>=b[0]&&box[1]<=b[3]&&box[3]>=b[1])grouped.push({...c,areaId:snapshot!.jurisdiction});}
  return {
    cases: grouped.slice(0, 1000).map((c) => {const safe=protectMapCase(c.areaId!, { ...publicFeature(c, c.areaId!, zoom), residentialPrivacy:residentialCase(c.areaId!,c.id.split(":").at(-1)!,c,overrides) }, overrides);return zoom<CASE_OUTLINE_ZOOM?{...safe,geometry:null}:safe;}),
    summaries,
    truncated: rows.length > 1000,
    updatedAt: new Date().toISOString(),
    bounds: b,
  };
}
export function cachedViewport(bounds:Bounds,zoom:number){const tags=Object.values(AREAS).filter(a=>{const b=bbox(a.boundary);return zoom<9||b[0]<=bounds[2]&&b[2]>=bounds[0]&&b[1]<=bounds[3]&&b[3]>=bounds[1];}).map(a=>"map-area:"+a.id);return unstable_cache(loadViewport,["viewport-cases-v8-private-names",...reviewCacheKeys],{revalidate:86400,tags:[...tags,PRIVACY_TAG,"case-timeline-v2"]})(bounds,zoom);}
async function manifest() {
  let counts: { area_id: string; count: number; upcoming: number }[] = [],
    revision = "local";
  if (databaseUrl()) {
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
  for(const snapshot of await reviewSnapshots())if(snapshot){counts=counts.filter(c=>c.area_id!==snapshot.jurisdiction);counts.push({area_id:snapshot.jurisdiction,count:snapshot.cases.length,upcoming:snapshot.cases.filter(c=>c.nextHearing).length});}
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
export const mapManifest = unstable_cache(manifest, ["map-manifest-v1",...reviewCacheKeys], {
  revalidate: 3600,
  tags: [MAP_INDEX_TAG, PRIVACY_TAG],
});

/** Authenticated export is paged below the serverless response limit; only public map properties leave Neon. */
export async function exportMapFeatures(cursor = "") {
  const [areaId = "", caseId = ""] = cursor.split(":");
  if (!databaseUrl())
    throw new Error("Export requires the configured database");
  const db = await database();
  const rows = (
    await db.query(
      "SELECT area_id,case_id,data->'geometry' AS geometry,data->>'title' AS title,data->>'stage' AS stage,data->>'href' AS href,data->'nextHearing'->>'date' AS next_date FROM law_map_cases WHERE area_id=ANY($1::text[]) AND (area_id,case_id)>($2,$3) AND data->'geometry' IS NOT NULL AND data->'geometry'<>'null'::jsonb AND NOT coalesce((data->>'citywide')::boolean,false) ORDER BY area_id,case_id LIMIT 500",
      [
        Object.values(AREAS)
          .filter((a) => a.status === "live")
          .map((a) => a.id),
        areaId,
        caseId,
      ],
    )
  ).rows;
  const features: import("geojson").Feature[] = [];
  let bytes = 0,
    nextCursor: string | undefined;
  for (const r of rows) {
    let geometry = r.geometry;
    try {
      geometry = simplify(feature(geometry), {
        tolerance: 0.00002,
        highQuality: false,
      }).geometry;
    } catch {}
    const f = {
      type: "Feature" as const,
      geometry,
      properties: {
        id: r.area_id + ":" + r.case_id,
        area: r.area_id,
        title: r.title,
        stage: r.stage,
        href: canonicalAreaHref(r.area_id, r.href),
        nextDate: r.next_date,
      },
    };
    const size = Buffer.byteLength(JSON.stringify(f));
    if (size > 3000000)
      throw Error("An export feature exceeds the response budget");
    if (features.length && bytes + size > 2500000) break;
    features.push(f);
    bytes += size;
    nextCursor = r.area_id + ":" + r.case_id;
  }
  return {
    features,
    nextCursor:
      features.length < rows.length || rows.length === 500
        ? nextCursor
        : undefined,
  };
}

/** Resolve linked site references on the server so shared links do not depend on map features arriving first. */
export async function siteMembers(item:MapCase,areaId:string){
 if(siteReviewAreaIds.includes(areaId))return;
 if(!item.geometry||item.citywide)return;
 if(databaseUrl()){await ensureSites();const rows=await indexQuery("SELECT data->'members' AS members FROM law_map_sites WHERE data->'members' @> $1::jsonb LIMIT 1",[JSON.stringify([{areaId,caseId:item.id}])]);return rows.rows[0]?.members as MapCase["members"];}
 return item.members;
}

export async function refreshSiteContent(){if(databaseUrl()){await database();await rebuildSites();}}
