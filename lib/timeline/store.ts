import { Pool } from "pg";
import { mkdir, readFile, writeFile, rename, rmdir, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emptyEvidenceState, type EvidenceState } from "./types";

export interface EvidenceStore {
  read(): Promise<EvidenceState>;
  mutate<T>(update: (state: EvidenceState) => T): Promise<T>;
}
let pool: Pool | undefined;
let initialized: Promise<void> | undefined;
function postgres() {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10000 });
  return pool;
}
async function initializeDatabase() {
  initialized ??= (async () => {
    await postgres().query("CREATE TABLE IF NOT EXISTS law_evidence (id text PRIMARY KEY, state jsonb NOT NULL)");
    await postgres().query("INSERT INTO law_evidence (id, state) VALUES ('timeline', $1::jsonb) ON CONFLICT DO NOTHING", [JSON.stringify(emptyEvidenceState())]);
  })().catch((error) => { initialized = undefined; throw error; });
  return initialized;
}
export function createFileStore(filename: string): EvidenceStore {
  const lockPath = filename + ".lock";
  const read = async () => {
    try { return JSON.parse(await readFile(filename, "utf8")) as EvidenceState; }
    catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyEvidenceState(); throw err; }
  };
  return { read, async mutate(update) {
    await mkdir(path.dirname(filename), { recursive: true });
    const started = Date.now();
    for (;;) {
      try { await mkdir(lockPath); break; }
      catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
        try { if (Date.now() - (await stat(lockPath)).mtimeMs > 60000) await rmdir(lockPath); } catch { /* Another writer released the lock. */ }
        if (Date.now() - started > 30000) throw new Error("Timeline store is busy");
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    }
    try {
      const state = await read();
      const result = update(state);
      const temporary = filename + "." + randomUUID() + ".tmp";
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
      await rename(temporary, filename);
      return result;
    } finally { await rmdir(lockPath); }
  } };
}
export function getEvidenceStore(): EvidenceStore {
  if (!process.env.DATABASE_URL) {
    if (process.env.VERCEL) throw new Error("DATABASE_URL is required for durable timeline storage on Vercel");
    return createFileStore(process.env.TIMELINE_LOCAL_PATH ?? path.join(process.cwd(), ".data", "timeline.json"));
  }
  return {
    async read() { await initializeDatabase(); return (await postgres().query("SELECT state FROM law_evidence WHERE id = 'timeline'")).rows[0].state as EvidenceState; },
    async mutate(update) {
      await initializeDatabase(); const client = await postgres().connect();
      try {
        await client.query("BEGIN");
        const state = (await client.query("SELECT state FROM law_evidence WHERE id = 'timeline' FOR UPDATE")).rows[0].state as EvidenceState;
        const result = update(state);
        await client.query("UPDATE law_evidence SET state = $1::jsonb WHERE id = 'timeline'", [JSON.stringify(state)]);
        await client.query("COMMIT"); return result;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
  };
}
export async function acquireLease(store: EvidenceStore, name: string, milliseconds = 900000) {
  return store.mutate((state) => {
    if ((state.leases[name]?.expiresAt ?? 0) > Date.now()) return null;
    const token = randomUUID(); state.leases[name] = { token, expiresAt: Date.now() + milliseconds }; return token;
  });
}
export async function releaseLease(store: EvidenceStore, name: string, token: string) {
  await store.mutate((state) => { if (state.leases[name]?.token === token) delete state.leases[name]; });
}
