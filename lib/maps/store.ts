import {databaseUrl} from "../runtime-environment";
import {isPreview} from "../runtime-environment";
import {readReviewSnapshot} from "../jurisdictions/review-snapshot";
import {requireProductionMutation} from "../runtime-environment";
import {jurisdiction,isSiteReviewArea} from "../jurisdictions/registry";
import {bbox} from "@turf/turf";
import {trackedRows} from "@/lib/db-transfer";
import {revalidateTag,unstable_cache} from "next/cache";
import { Pool } from "../database-pool";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { MapSnapshot,FlumCache } from "./types";
let pool: Pool | undefined, initialized: Promise<unknown> | undefined;
function database() {
  pool ??= new Pool({ connectionString: databaseUrl(), max: 2, connectionTimeoutMillis: 10000 });
  initialized ??= pool.query(`CREATE TABLE IF NOT EXISTS law_map_cache (jurisdiction text PRIMARY KEY, snapshot jsonb NOT NULL);
 CREATE TABLE IF NOT EXISTS law_flum_cache(jurisdiction text PRIMARY KEY,snapshot jsonb NOT NULL);
 INSERT INTO law_flum_cache SELECT jurisdiction,snapshot->'flum' FROM law_map_cache WHERE snapshot?'flum' AND snapshot->'flum'<>'null'::jsonb ON CONFLICT DO NOTHING;
 UPDATE law_map_cache SET snapshot=snapshot-'flum' WHERE snapshot?'flum';`).catch((e) => { initialized = undefined; throw e; });
  return pool;
}
function filename(id: string) { if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid map cache ID"); return path.join(process.cwd(), ".data", "maps", id + ".json"); }
export async function readMapSnapshot(id: string,options:{caseIds?:readonly string[];includeFlum?:boolean;bounds?:readonly number[]}={includeFlum:true}): Promise<MapSnapshot | undefined> {
  if(isPreview()){const review=readReviewSnapshot(id);if(!review)return;const snapshot=structuredClone(review.map);if(options.caseIds)snapshot.cases=snapshot.cases.filter(c=>options.caseIds!.includes(c.id));return snapshot;}
  if(jurisdiction(id)&&!jurisdiction(id).legacyPublic){const snapshot=await(await import("../jurisdictions/runtime")).configuredSnapshot(id);if(options.caseIds)snapshot.cases=snapshot.cases.filter(c=>options.caseIds!.includes(c.id));if(options.bounds)snapshot.cases=snapshot.cases.filter(c=>{const b=c.bounds,q=options.bounds!;return b&&b[0]<=q[2]&&b[2]>=q[0]&&b[1]<=q[3]&&b[3]>=q[1];});if(options.includeFlum)snapshot.flum=await readFlumSnapshot(id);return snapshot;}
 if (databaseUrl()) {
   const db=database();await initialized;
   if(options.bounds){
    const query=`SELECT (snapshot-'cases')||jsonb_build_object('cases',coalesce((
     SELECT jsonb_agg(c) FROM jsonb_array_elements(snapshot->'cases') c
     CROSS JOIN LATERAL (SELECT coalesce(c->'bounds',(SELECT jsonb_build_array(min((p->>0)::float),min((p->>1)::float),max((p->>0)::float),max((p->>1)::float)) FROM jsonb_path_query(c->'geometry','$.coordinates.** ? (@.type() == "array")') p WHERE jsonb_typeof(p->0)='number' AND jsonb_typeof(p->1)='number')) AS b) bounds
     WHERE c->'geometry'<>'null'::jsonb AND (b->>0)::float<=($2::float8[])[3] AND (b->>2)::float>=($2::float8[])[1] AND (b->>1)::float<=($2::float8[])[4] AND (b->>3)::float>=($2::float8[])[2]
     ),'[]'::jsonb)) AS snapshot FROM law_map_cache WHERE jurisdiction=$1`;
    return trackedRows("maps",(await db.query(query,[id,options.bounds])).rows)[0]?.snapshot as MapSnapshot|undefined;
   }
   const query=options.caseIds?"SELECT (snapshot-'cases')||jsonb_build_object('cases',coalesce((SELECT jsonb_agg(c) FROM jsonb_array_elements(snapshot->'cases') c WHERE c->>'id'=ANY($2::text[])),'[]'::jsonb)) AS snapshot FROM law_map_cache WHERE jurisdiction=$1":"SELECT snapshot FROM law_map_cache WHERE jurisdiction=$1";
   const snapshot=trackedRows("maps",(await db.query(query,options.caseIds?[id,options.caseIds]:[id])).rows)[0]?.snapshot as MapSnapshot|undefined;
   if(snapshot&&options.includeFlum)snapshot.flum=await readFlumSnapshot(id);
   return snapshot;
  }
  if (process.env.VERCEL) throw new Error("Map storage requires DATABASE_URL");
  try { const snapshot=JSON.parse(await readFile(filename(id), "utf8")) as MapSnapshot;
   if(options.bounds)snapshot.cases=snapshot.cases.filter(c=>{if(!c.geometry)return false;const b=c.bounds??bbox(c.geometry),q=options.bounds!;return b[0]<=q[2]&&b[2]>=q[0]&&b[1]<=q[3]&&b[3]>=q[1];});
   if(options.caseIds)snapshot.cases=snapshot.cases.filter(c=>options.caseIds!.includes(c.id));
   if(options.includeFlum===false)delete snapshot.flum;return snapshot; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
}
export async function saveMapSnapshot(snapshot: MapSnapshot) {
  requireProductionMutation();
  if(isSiteReviewArea(snapshot.jurisdiction))return;
  if (databaseUrl()) {
   const db=database();await initialized;const {flum,...cases}=snapshot;
   await db.query("INSERT INTO law_map_cache (jurisdiction,snapshot) VALUES ($1,$2::jsonb) ON CONFLICT (jurisdiction) DO UPDATE SET snapshot=excluded.snapshot",[snapshot.jurisdiction,JSON.stringify(cases)]);
   if(flum){const result=await db.query("INSERT INTO law_flum_cache VALUES($1,$2::jsonb) ON CONFLICT(jurisdiction) DO UPDATE SET snapshot=excluded.snapshot WHERE law_flum_cache.snapshot->>'updatedAt' IS DISTINCT FROM excluded.snapshot->>'updatedAt'",[snapshot.jurisdiction,JSON.stringify(flum)]);if(result.rowCount&&process.env.NEXT_RUNTIME&&process.env.NODE_ENV!=="test")revalidateTag("map-flum",{expire:0});}
   const {syncCaseIndex}=await import("./case-index");await syncCaseIndex(snapshot);
   return;
  }
  if (process.env.VERCEL) throw new Error("Map storage requires DATABASE_URL");
  const file = filename(snapshot.jurisdiction); await mkdir(path.dirname(file), { recursive: true }); const tmp = file + "." + randomUUID() + ".tmp"; await writeFile(tmp, JSON.stringify(snapshot)); await rename(tmp, file);
}

async function loadFlum(id:string):Promise<FlumCache|undefined>{const db=database();await initialized;return trackedRows("flum",(await db.query("SELECT snapshot FROM law_flum_cache WHERE jurisdiction=$1",[id])).rows)[0]?.snapshot;}
const cachedFlum=unstable_cache(loadFlum,["flum-storage-v2"],{revalidate:604800,tags:["map-flum"]});
/** Bounded, authenticated offline export; public map views never call this. */
export async function exportFlumPage(id:string,offset:number){
 if(!databaseUrl()){const data=await readFlumSnapshot(id);const features=data?.geojson.features.slice(offset,offset+250)??[];return{updatedAt:data?.updatedAt,legend:data?.legend??[],features,nextOffset:data&&offset+features.length<data.geojson.features.length?offset+features.length:undefined};}
 const db=database();await initialized;
 const result=await db.query(`SELECT snapshot->>'updatedAt' AS "updatedAt",snapshot->'legend' AS legend,jsonb_array_length(snapshot->'geojson'->'features') AS total,
 coalesce((SELECT jsonb_agg(f ORDER BY n) FROM jsonb_array_elements(snapshot->'geojson'->'features') WITH ORDINALITY AS items(f,n) WHERE n>$2 AND n<=$2+250),'[]'::jsonb) AS features
 FROM law_flum_cache WHERE jurisdiction=$1`,[id,offset]);
 const row=trackedRows("flum-export",result.rows)[0];
 if(!row)return{features:[],legend:[]};
 return{updatedAt:row.updatedAt,legend:row.legend,features:row.features,nextOffset:offset+row.features.length<row.total?offset+row.features.length:undefined};
}
export async function readFlumSnapshot(id:string,options?:{bounds:readonly number[]}){
 if(isPreview())return undefined;
 if(isSiteReviewArea(id)){const config=(await import("./jurisdictions")).getJurisdiction(id);return config?(await import("./refresh")).fetchFlum(config):undefined;}
 if(!databaseUrl())return(await readMapSnapshot(id))?.flum;
 if(options?.bounds){
  const db=database();await initialized;
  const query=`SELECT (snapshot-'geojson')||jsonb_build_object('geojson',jsonb_build_object('type','FeatureCollection','features',coalesce((
   SELECT jsonb_agg(f) FROM jsonb_array_elements(snapshot->'geojson'->'features') f
   CROSS JOIN LATERAL (SELECT coalesce(f->'bbox',(SELECT jsonb_build_array(min((p->>0)::float),min((p->>1)::float),max((p->>0)::float),max((p->>1)::float)) FROM jsonb_path_query(f->'geometry','$.coordinates.** ? (@.type() == "array")') p WHERE jsonb_typeof(p->0)='number' AND jsonb_typeof(p->1)='number')) AS b) bounds
   WHERE (b->>0)::float<=($2::float8[])[3] AND (b->>2)::float>=($2::float8[])[1] AND (b->>1)::float<=($2::float8[])[4] AND (b->>3)::float>=($2::float8[])[2]
  ),'[]'::jsonb))) AS snapshot FROM law_flum_cache WHERE jurisdiction=$1`;
  return trackedRows("flum",(await db.query(query,[id,options.bounds])).rows)[0]?.snapshot as FlumCache|undefined;
 }
 return process.env.NEXT_RUNTIME&&process.env.NODE_ENV!=="test"?cachedFlum(id):loadFlum(id);
}

/** Image workers read only queue metadata, never the FLUM or all case geometries. */
export async function mapImageCases(id:string):Promise<{id:string;hasGeometry:boolean;citywide:boolean}[]>{
 if(databaseUrl()){const db=database();await initialized;return(await db.query("SELECT c->>'id' AS id,(c->'geometry' IS NOT NULL AND c->'geometry'<>'null'::jsonb) AS geometry,coalesce((c->>'citywide')::boolean,false) AS citywide FROM law_map_cache,jsonb_array_elements(snapshot->'cases') c WHERE jurisdiction=$1",[id])).rows.map(r=>({id:r.id,hasGeometry:r.geometry,citywide:r.citywide}));}
 return (await readMapSnapshot(id,{includeFlum:false}))?.cases.map(c=>({id:c.id,hasGeometry:Boolean(c.geometry),citywide:c.citywide}))??[];
}
export async function markCaseVisualScan(id:string,caseId:string,finishedAt:string){
 if(databaseUrl()){const db=database();await initialized;await db.query("UPDATE law_map_cache SET snapshot=jsonb_set(snapshot,'{cases}',(SELECT jsonb_agg(CASE WHEN c->>'id'=$2 THEN c||jsonb_build_object('visualCheckedAt',$3::text) ELSE c END) FROM jsonb_array_elements(snapshot->'cases') c)) WHERE jurisdiction=$1",[id,caseId,finishedAt]);return;}
 const snapshot=await readMapSnapshot(id);if(snapshot){const c=snapshot.cases.find(c=>c.id===caseId);if(c)c.visualCheckedAt=finishedAt;await saveMapSnapshot(snapshot);}
}
