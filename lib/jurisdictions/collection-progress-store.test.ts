import {afterAll,afterEach,beforeAll,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
const h=vi.hoisted(()=>({db:null as unknown as PGlite,queries:0}));
vi.mock("./store",()=>({jurisdictionDb:async()=>({query:async(sql:string,params:unknown[])=>{h.queries++;return h.db.query(sql,params);}})}));
vi.mock("./migrations",()=>({ensureOnboardingSchema:vi.fn(async()=>{})}));
import {claimCollectionProgress} from "./collection-progress-store";
import type {AgendaProgress} from "./agenda-progress";
beforeAll(async()=>{h.db=new PGlite();await h.db.waitReady;await h.db.exec(readFileSync("migrations/20261105_collection_progress.up.sql","utf8"));});
afterAll(async()=>{await h.db.close();});afterEach(()=>vi.unstubAllEnvs());
const progress:AgendaProgress={key:"fixture",startedAt:"2026-11-05T16:00:00Z",sources:{official:{meeting:{fingerprint:"verified",meeting:{id:"one",title:"Official hearing",body:"pz",date:"2026-11-02",meetingPageUrl:"https://official.test/one",items:[],attachments:[]}}}}};
it("durably saves private progress, rejects concurrent collection, and resumes after release",async()=>{
 vi.stubEnv("VERCEL_ENV","production");const first=await claimCollectionProgress("boise");await first.save(progress);
 await expect(claimCollectionProgress("boise")).rejects.toThrow("already in progress");await first.release();
 const next=await claimCollectionProgress("boise");expect(next.previous).toEqual(progress);await next.clear();await next.release();
 expect((await h.db.query("SELECT * FROM law_jurisdiction_collection_progress")).rows).toHaveLength(0);
});
it("recovers an expired lease and prevents a stale worker from overwriting the new checkpoint",async()=>{
 vi.stubEnv("VERCEL_ENV","production");const first=await claimCollectionProgress("boise");await first.save(progress);
 await h.db.exec("UPDATE law_jurisdiction_collection_progress SET lease_until=now()-interval '1 second'");
 const next=await claimCollectionProgress("boise");await expect(first.save({...progress,key:"stale"})).rejects.toThrow("lease was lost");
 await first.clear();await first.release();await next.save({...progress,key:"new"});await next.release();
 const last=await claimCollectionProgress("boise");expect(last.previous.key).toBe("new");await last.clear();await last.release();
});
it("refuses checkpoint writes in Preview before any database query",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");const calls=h.queries;await expect(claimCollectionProgress("boise")).rejects.toThrow("Writes are disabled");expect(h.queries).toBe(calls);
});
