import { Pool } from "pg";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { MapSnapshot } from "./types";
let pool: Pool | undefined, initialized: Promise<unknown> | undefined;
function database() {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000 });
  initialized ??= pool.query("CREATE TABLE IF NOT EXISTS law_map_cache (jurisdiction text PRIMARY KEY, snapshot jsonb NOT NULL)").catch((e) => { initialized = undefined; throw e; });
  return pool;
}
function filename(id: string) { if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid map cache ID"); return path.join(process.cwd(), ".data", "maps", id + ".json"); }
export async function readMapSnapshot(id: string): Promise<MapSnapshot | undefined> {
  if (process.env.DATABASE_URL) { const db = database(); await initialized; return (await db.query("SELECT snapshot FROM law_map_cache WHERE jurisdiction=$1", [id])).rows[0]?.snapshot; }
  if (process.env.VERCEL) throw new Error("Map storage requires DATABASE_URL");
  try { return JSON.parse(await readFile(filename(id), "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
}
export async function saveMapSnapshot(snapshot: MapSnapshot) {
  if (process.env.DATABASE_URL) { const db = database(); await initialized; await db.query("INSERT INTO law_map_cache (jurisdiction,snapshot) VALUES ($1,$2::jsonb) ON CONFLICT (jurisdiction) DO UPDATE SET snapshot=excluded.snapshot", [snapshot.jurisdiction, JSON.stringify(snapshot)]); return; }
  if (process.env.VERCEL) throw new Error("Map storage requires DATABASE_URL");
  const file = filename(snapshot.jurisdiction); await mkdir(path.dirname(file), { recursive: true }); const tmp = file + "." + randomUUID() + ".tmp"; await writeFile(tmp, JSON.stringify(snapshot)); await rename(tmp, file);
}
