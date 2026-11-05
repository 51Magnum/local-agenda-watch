import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from "vitest";
import type {StagingSnapshot} from "./store";
const h=vi.hoisted(()=>({db:undefined as unknown as PGlite,drift:true}));
vi.mock("./store",()=>({jurisdictionDb:async()=>h.db,jurisdictionTransaction:async(work:(db:PGlite)=>Promise<unknown>)=>h.db.transaction(tx=>work(tx as unknown as PGlite))}));
vi.mock("../runtime-environment",async original=>({...await original<typeof import("../runtime-environment")>(),databaseUrl:()=>"fixture"}));
vi.mock("./review-snapshot",()=>({readReviewSnapshot:()=>undefined,snapshotDrift:()=>({pass:h.drift,reason:"Reviewed snapshot mismatch"})}));
import {publicationState,publicationRecordIds,resumeJurisdiction} from "./publication-state";
import {persistSelfCheck,pauseJurisdiction,readPublished} from "./self-check-store";
import {selfCheck} from "./self-check";
import {jurisdiction} from "./registry";

const d={...jurisdiction("ada-county"),recordLinks:undefined,selfCheck:{minPassRate:.95}},description="Conditional Use for a contractor yard";
const snapshot:StagingSnapshot={areaId:d.id,launchStatus:"admin_only",applications:[{recordId:"202600934-CU",projectNumber:"202600934",relatedCaseNumbers:["202600934-MSP"],type:"Conditional Use",description,name:description,address:"",status:"Active",parcel:[],recordUrl:"https://official.test/202600934",sourceUrl:"https://official.test/202600934",sourceFields:{AppApplicDesc:description}}],meetings:[],boundary:{type:"Polygon",coordinates:[[[-117,43],[-116,43],[-116,44],[-117,44],[-117,43]]]},complete:true,checkedAt:"2026-11-05T12:00:00Z",range:{start:"2026-08-07",end:"2026-12-20"},health:[],skipped:[]};
beforeAll(async()=>{h.db=new PGlite();for(const file of ["20261027_jurisdiction_onboarding.up.sql","20261031_self_check.up.sql"])await h.db.exec(readFileSync("migrations/"+file,"utf8"));});
beforeEach(async()=>{h.drift=true;await h.db.exec("TRUNCATE law_jurisdiction_publications,law_jurisdiction_exceptions,law_jurisdiction_qa,law_jurisdiction_approvals,law_jurisdiction_snapshots CASCADE");});
afterEach(()=>vi.unstubAllEnvs());afterAll(async()=>{await h.db.close();});
async function seed(){
 await h.db.query("INSERT INTO law_jurisdiction_snapshots(area_id,launch_status,data) VALUES($1,$2,$3)",[d.id,"admin_only",JSON.stringify(snapshot)]);
 const report=await selfCheck(d,snapshot,{links:async()=>({status:200,text:"202600934"})});await persistSelfCheck(snapshot,report);return report;
}
it("distinguishes passing QA from a durable pause, and only explicit resume exposes approved records",async()=>{
 const report=await seed();expect((await publicationState(d.id)).publiclyVisible).toBe(true);
 await pauseJurisdiction(d.id,"admin");await persistSelfCheck(snapshot,report);
 expect(await publicationState(d.id)).toMatchObject({status:"paused",checksPassed:true,publiclyVisible:false,canResume:true,publishedRecords:1});
 expect(await readPublished(d.id)).toBeUndefined();expect(JSON.stringify(await publicationState(d.id))).not.toContain(description);
 expect((await publicationRecordIds(d.id)).sort()).toEqual(["202600934-CU","202600934-MSP"]);
 expect(await resumeJurisdiction(d.id,"admin")).toMatchObject({status:"public",publiclyVisible:true});
 expect((await readPublished(d.id))?.applications).toHaveLength(1);
 await expect(resumeJurisdiction(d.id,"admin")).resolves.toMatchObject({status:"public"});
});
it("refuses resume when staging changed since its passing approval",async()=>{
 await seed();await pauseJurisdiction(d.id,"admin");
 await h.db.query("UPDATE law_jurisdiction_snapshots SET data=$2 WHERE area_id=$1",[d.id,JSON.stringify({...snapshot,applications:snapshot.applications.map(a=>({...a,description:"A changed proposal"}))})]);
 expect((await publicationState(d.id)).canResume).toBe(false);
 await expect(resumeJurisdiction(d.id,"admin")).rejects.toThrow("Staging changed");
 expect(await readPublished(d.id)).toBeUndefined();
});
it("refuses resume when the committed review changed or the current check failed",async()=>{
 await seed();await pauseJurisdiction(d.id,"admin");h.drift=false;
 await expect(resumeJurisdiction(d.id,"admin")).rejects.toThrow("Reviewed snapshot mismatch");
 h.drift=true;await h.db.query("UPDATE law_jurisdiction_qa SET passed=false");
 await expect(resumeJurisdiction(d.id,"admin")).rejects.toThrow("passing self-check");
 await h.db.query("UPDATE law_jurisdiction_qa SET passed=true");await h.db.query("UPDATE law_jurisdiction_publications SET approval_id=NULL");
 await expect(resumeJurisdiction(d.id,"admin")).rejects.toThrow("passing self-check");
 expect(await readPublished(d.id)).toBeUndefined();
});
it("does not publish missing, review-only, unauthorized or Preview records",async()=>{
 expect((await publicationState(d.id)).status).toBe("missing");
 await expect(resumeJurisdiction(d.id,"admin")).rejects.toThrow("No stored publication");
 await seed();await h.db.query("UPDATE law_jurisdiction_publications SET status='review'");
 await expect(resumeJurisdiction(d.id,"admin")).rejects.toThrow("Only a paused");
 await expect(resumeJurisdiction(d.id," ")).rejects.toThrow("Authenticated reviewer");
 vi.stubEnv("VERCEL_ENV","preview");await expect(resumeJurisdiction(d.id,"admin")).rejects.toThrow("disabled");
});
