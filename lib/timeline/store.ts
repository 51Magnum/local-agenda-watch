import { createPostgresStore } from "./postgres-store";
import { mkdir, readFile, writeFile, rename, rmdir, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emptyEvidenceState, type EvidenceState } from "./types";

export interface EvidenceStore {
  read(): Promise<EvidenceState>;
  mutate<T>(update: (state: EvidenceState) => T): Promise<T>;
  flush?():Promise<void>;
  pages?(id:string):Promise<import("./types").PageText[]>;
  readCase?(areaId:string,caseIds:string[]):Promise<EvidenceState>;
  lease?(name:string,milliseconds:number):Promise<string|null>;
  release?(name:string,token:string):Promise<void>;
  metrics?:{readBytes:number;writeBytes:number;queries:number;legacyRowBytes?:number};
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
export function getEvidenceStore(options:{buffered?:boolean}={}): EvidenceStore {
  if (!process.env.DATABASE_URL) {
    if (process.env.VERCEL) throw new Error("DATABASE_URL is required for durable timeline storage on Vercel");
    return createFileStore(process.env.TIMELINE_LOCAL_PATH ?? path.join(process.cwd(), ".data", "timeline.json"));
  }
  return createPostgresStore(options);
}
export async function acquireLease(store: EvidenceStore, name: string, milliseconds = 900000) {
  if(store.lease)return store.lease(name,milliseconds);
  return store.mutate((state) => {
    if ((state.leases[name]?.expiresAt ?? 0) > Date.now()) return null;
    const token = randomUUID(); state.leases[name] = { token, expiresAt: Date.now() + milliseconds }; return token;
  });
}
export async function releaseLease(store: EvidenceStore, name: string, token: string) {
  if(store.release){await store.release(name,token);return;}
  await store.mutate((state) => { if (state.leases[name]?.token === token) delete state.leases[name]; });
}

/** Explicit admin retry is durable and audited; a failed document never approves its evidence. */
export async function resetDocumentRetry(store:EvidenceStore,id:string){
 await store.mutate(state=>{
  const doc=state.documents[id];if(!doc)throw new Error("Document not found");
  doc.failCount=0;delete doc.lastAttemptAt;delete doc.error;
  if(doc.state==="failed-permanent"||doc.state==="error")doc.state="processing";
  (state.retryAudit??=[]).push({documentId:id,at:new Date().toISOString()});
 });
}
