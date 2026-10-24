import {unstable_cache} from "next/cache";
import { Pool } from "pg";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { MapSnapshot,FlumCache } from "./types";
let pool: Pool | undefined, initialized: Promise<unknown> | undefined;
function database() {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000 });
  initialized ??= pool.query(`CREATE TABLE IF NOT EXISTS law_map_cache (jurisdiction text PRIMARY KEY, snapshot jsonb NOT NULL);
 CREATE TABLE IF NOT EXISTS law_flum_cache(jurisdiction text PRIMARY KEY,snapshot jsonb NOT NULL);
 INSERT INTO law_flum_cache SELECT jurisdiction,snapshot->'flum' FROM law_map_cache WHERE snapshot?'flum' AND snapshot->'flum'<>'null'::jsonb ON CONFLICT DO NOTHING;
 UPDATE law_map_cache SET snapshot=snapshot-'flum' WHERE snapshot?'flum';`).catch((e) => { initialized = undefined; throw e; });
  return pool;
}
function filename(id: string) { if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid map cache ID"); return path.join(process.cwd(), ".data", "maps", id + ".json"); }
export async function readMapSnapshot(id: string,options:{caseIds?:readonly string[];includeFlum?:boolean}={includeFlum:true}): Promise<MapSnapshot | undefined> {
  if (process.env.DATABASE_URL) {
   const db=database();await initialized;
   const query=options.caseIds?"SELECT (snapshot-'cases')||jsonb_build_object('cases',coalesce((SELECT jsonb_agg(c) FROM jsonb_array_elements(snapshot->'cases') c WHERE c->>'id'=ANY($2::text[])),'[]'::jsonb)) AS snapshot FROM law_map_cache WHERE jurisdiction=$1":"SELECT snapshot FROM law_map_cache WHERE jurisdiction=$1";
   const snapshot=(await db.query(query,options.caseIds?[id,options.caseIds]:[id])).rows[0]?.snapshot as MapSnapshot|undefined;
   if(snapshot&&options.includeFlum)snapshot.flum=await readFlumSnapshot(id);
   return snapshot;
  }
  if (process.env.VERCEL) throw new Error("Map storage requires DATABASE_URL");
  try { return JSON.parse(await readFile(filename(id), "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
}
export async function saveMapSnapshot(snapshot: MapSnapshot) {
  if (process.env.DATABASE_URL) {
   const db=database();await initialized;const {flum,...cases}=snapshot;
   await db.query("INSERT INTO law_map_cache (jurisdiction,snapshot) VALUES ($1,$2::jsonb) ON CONFLICT (jurisdiction) DO UPDATE SET snapshot=excluded.snapshot",[snapshot.jurisdiction,JSON.stringify(cases)]);
   if(flum)await db.query("INSERT INTO law_flum_cache VALUES($1,$2::jsonb) ON CONFLICT(jurisdiction) DO UPDATE SET snapshot=excluded.snapshot WHERE law_flum_cache.snapshot->>'updatedAt' IS DISTINCT FROM excluded.snapshot->>'updatedAt'",[snapshot.jurisdiction,JSON.stringify(flum)]);
   return;
  }
  if (process.env.VERCEL) throw new Error("Map storage requires DATABASE_URL");
  const file = filename(snapshot.jurisdiction); await mkdir(path.dirname(file), { recursive: true }); const tmp = file + "." + randomUUID() + ".tmp"; await writeFile(tmp, JSON.stringify(snapshot)); await rename(tmp, file);
}

async function loadFlum(id:string):Promise<FlumCache|undefined>{const db=database();await initialized;return(await db.query("SELECT snapshot FROM law_flum_cache WHERE jurisdiction=$1",[id])).rows[0]?.snapshot;}
const cachedFlum=unstable_cache(loadFlum,["flum-storage-v2"],{revalidate:3600,tags:["map-flum"]});
export async function readFlumSnapshot(id:string){if(!process.env.DATABASE_URL)return(await readMapSnapshot(id))?.flum;return process.env.NEXT_RUNTIME&&process.env.NODE_ENV!=="test"?cachedFlum(id):loadFlum(id);}
