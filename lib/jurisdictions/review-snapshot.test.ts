import {readFileSync,readdirSync} from "node:fs";
import {afterEach,expect,it,vi} from "vitest";
import {snapshotDrift,type ReviewSnapshot} from "./review-snapshot";
import {scrubReview} from "./write-review-snapshot";
import type {SelfCheckReport} from "./self-check";
afterEach(()=>vi.unstubAllEnvs());
const report=(ids:string[],goLive=true)=>({records:ids.map(recordId=>({recordId,publish:true})),goLive}) as SelfCheckReport;
const baseline={selfCheck:report(["1","2","3","4"])} as ReviewSnapshot;
it("allows a few changed records but refuses material drift, missing baselines and changed decisions",()=>{
 expect(snapshotDrift(baseline,report(["1","2","3","4","5"])).pass).toBe(true);
 expect(snapshotDrift(baseline,report(["5","6","7","8"])).pass).toBe(false);
 expect(snapshotDrift(baseline,report(["1","2","3","4"],false)).pass).toBe(false);
 expect(snapshotDrift(undefined,report([])).pass).toBe(false);
 const redacted={selfCheck:{...baseline.selfCheck,records:baseline.selfCheck.records.map(r=>({...r,title:"[Resident title withheld]"}))}} as ReviewSnapshot;
 expect(snapshotDrift(redacted,baseline.selfCheck).pass).toBe(true);
 const changed=report(["1","2","3","4"]);changed.records=changed.records.map(r=>({...r,sourceHash:"revised official source"}));
 expect(snapshotDrift(baseline,changed).pass).toBe(false);
});
it("drops individual identities, encoded staff contacts and unsafe links",()=>{
 const clean=scrubReview({title:"Yard for Example Person",safe:"Contractor yard",email:"staff%40agency.gov",url:"http://example.test",raw:"https://official.test/query?f=pjson"},["Example Person"]);
 expect(clean).toEqual({safe:"Contractor yard"});
 expect(scrubReview("A warehouse and storage yard",["Idaho Fish and Game"])).toBe("A warehouse and storage yard");
});
it("committed review artifacts have resident records and no contacts or raw source fields",()=>{
 for(const file of readdirSync("data/review").filter(f=>f.endsWith(".json"))){
  const text=readFileSync("data/review/"+file,"utf8"),snapshot=JSON.parse(text) as ReviewSnapshot;
  expect(snapshot.status).toBe("review");expect(snapshot.records.length).toBeGreaterThan(0);
  expect(text).not.toMatch(/mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,}|"sourceFields"|"APPLICANT"/i);
  expect(snapshot.selfCheck.records.length).toBe(snapshot.records.length);
 }
});
it("starts the timeline in Preview without database environment variables",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("DATABASE_URL","");
 const {getEvidenceStore}=await import("../timeline/store");
 expect(await (await getEvidenceStore()).read()).toBeDefined();
});
