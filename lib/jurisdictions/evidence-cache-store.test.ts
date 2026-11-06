import {beforeAll,afterAll,afterEach,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
const h=vi.hoisted(()=>({db:null as unknown as PGlite,calls:0}));
vi.mock("./store",()=>({jurisdictionDb:async()=>({query:async(sql:string,params:unknown[])=>{h.calls++;return h.db.query(sql,params);}})}));
vi.mock("./migrations",()=>({ensureOnboardingSchema:vi.fn(async()=>{})}));
import {productionEvidenceCache} from "./evidence-cache";
beforeAll(async()=>{h.db=new PGlite();await h.db.waitReady;await h.db.exec(readFileSync("migrations/20261106_source_evidence.up.sql","utf8"));});
afterAll(async()=>{await h.db.close();});afterEach(()=>vi.unstubAllEnvs());
it("persists evidence privately by exact cycle, accepts long URLs and expires old proofs",async()=>{
 vi.stubEnv("VERCEL_ENV","production");const cache=await productionEvidenceCache("boise"),url="https://official.test/document?key="+"a".repeat(4000),proof={status:200,text:"PLN26-00001",evidenceHash:"fixture"};
 await cache.write("cycle-one",url,proof);expect((await cache.read("cycle-one"))[url]).toEqual(proof);expect(await cache.read("different-cycle")).toEqual({});
 await h.db.exec("UPDATE law_jurisdiction_source_evidence SET updated_at=now()-interval '3 hours'");expect(await cache.read("cycle-one")).toEqual({});await productionEvidenceCache("boise");expect((await h.db.query("SELECT * FROM law_jurisdiction_source_evidence")).rows).toHaveLength(0);
});
it("cannot initialize or write proof cache in Preview",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");const calls=h.calls;await expect(productionEvidenceCache("boise")).rejects.toThrow("Writes are disabled");expect(h.calls).toBe(calls);
});
