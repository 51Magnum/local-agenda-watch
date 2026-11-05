import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
import {afterAll,beforeAll,beforeEach,expect,it,vi} from "vitest";
import type {StagingSnapshot} from "./store";
import type {ReviewSnapshot} from "./review-snapshot";
import type {Application} from "./adapters/types";
const h=vi.hoisted(()=>({db:undefined as unknown as PGlite,baseline:undefined as ReviewSnapshot|undefined}));
vi.mock("./store",()=>({jurisdictionDb:async()=>h.db,jurisdictionTransaction:async(work:(db:PGlite)=>Promise<unknown>)=>h.db.transaction(tx=>work(tx as unknown as PGlite))}));
vi.mock("../runtime-environment",()=>({isPreview:()=>false,databaseUrl:()=>"isolated-jsonb-fixture",requireOnboardingMutation:()=>{}}));
vi.mock("./review-snapshot",async original=>({...await original<typeof import("./review-snapshot")>(),readReviewSnapshot:()=>h.baseline}));
import {selfCheck,sourceHash} from "./self-check";
import {snapshotDrift} from "./review-snapshot";
import {persistSelfCheck,readPublished} from "./self-check-store";
import {jurisdiction} from "./registry";

const d={...jurisdiction("ada-county"),recordLinks:undefined,selfCheck:{minPassRate:.95}};
const description="Conditional Use for a contractor yard";
const applications:Application[]=Array.from({length:40},(_,index)=>{
 const id=String(202600000+index),agendaOnly=index>=38;
 return {recordId:id+"-CU",projectNumber:id,relatedCaseNumbers:[],type:"Conditional Use",description,name:description,address:"",status:"Active",parcel:[],recordUrl:"https://official.test/"+id,sourceUrl:"https://official.test/"+id,...agendaOnly?{agendaOnly:true}:{},sourceFields:agendaOnly?{}:{APPFILE:id+"-CU",AppApplicDesc:description,APPLICANT:"Example Development LLC",nested:{z:1,a:2}}};
});
const snapshot:StagingSnapshot={areaId:d.id,launchStatus:"admin_only",applications,meetings:[],checkedAt:"2026-11-05T12:00:00Z",range:{start:"2026-08-07",end:"2026-12-20"},complete:true,health:[],skipped:[]};
const links=async()=>({status:200,text:applications.map(a=>a.projectNumber).join(" ")});
const legacyHash=(a:Application)=>createHash("sha256").update(JSON.stringify([a.recordId,a.relatedCaseNumbers,a.type,a.description,a.sourceFields,a.recordUrl,a.geometry])).digest("hex");
async function roundTrip(s:StagingSnapshot){return(await h.db.query<{data:StagingSnapshot}>("SELECT $1::jsonb AS data",[JSON.stringify(s)])).rows[0].data;}
async function stage(s:StagingSnapshot){await h.db.query("INSERT INTO law_jurisdiction_snapshots(area_id,launch_status,data) VALUES($1,$2,$3)",[s.areaId,s.launchStatus,JSON.stringify(s)]);}
beforeAll(async()=>{h.db=new PGlite();await h.db.exec(readFileSync("migrations/20261027_jurisdiction_onboarding.up.sql","utf8"));await h.db.exec(readFileSync("migrations/20261031_self_check.up.sql","utf8"));});
beforeEach(async()=>{h.baseline=undefined;await h.db.exec("TRUNCATE law_jurisdiction_publications,law_jurisdiction_exceptions,law_jurisdiction_qa,law_jurisdiction_approvals,law_jurisdiction_snapshots CASCADE");});
afterAll(async()=>{await h.db.close();});

it("reproduces exactly 38 false mismatches through real PostgreSQL JSONB and fixes every one",async()=>{
 const stored=await roundTrip(snapshot);
 expect(applications.filter((a,i)=>legacyHash(a)!==legacyHash(stored.applications[i]))).toHaveLength(38);
 expect(applications.filter((a,i)=>sourceHash(a)!==sourceHash(stored.applications[i]))).toHaveLength(0);
});
it("allows the actual publication gate after collect and check use separate JSONB round trips",async()=>{
 const reviewed=await selfCheck(d,snapshot,{links}),stored=await roundTrip(snapshot),actual=await selfCheck(d,stored,{links});
 h.baseline={selfCheck:reviewed} as ReviewSnapshot;
 expect(reviewed.goLive).toBe(true);expect(actual.records.map(r=>r.sourceHash)).toEqual(reviewed.records.map(r=>r.sourceHash));
 expect(snapshotDrift(h.baseline,actual)).toMatchObject({pass:true,changed:0});
 await stage(stored);await persistSelfCheck(stored,actual);
 expect((await readPublished(d.id))?.applications).toHaveLength(40);
});
it("still withholds first publication when four actual source descriptions change",async()=>{
 const reviewed=await selfCheck(d,snapshot,{links}),changed=await roundTrip(snapshot);
 for(const a of changed.applications.slice(0,4)){a.description="Conditional Use for a larger contractor yard";a.sourceFields.AppApplicDesc=a.description;}
 const actual=await selfCheck(d,changed,{links});h.baseline={selfCheck:reviewed} as ReviewSnapshot;
 expect(actual.goLive).toBe(true);expect(snapshotDrift(h.baseline,actual)).toMatchObject({pass:false,changed:4});
 await stage(changed);await persistSelfCheck(changed,actual);
 expect(actual.goLive).toBe(false);expect(await readPublished(d.id)).toBeUndefined();
 expect(actual.queue.some(q=>q.check.check==="review-snapshot-matches")).toBe(true);
});
it("continues hashing nested source values, geometry coordinates and record URLs",()=>{
 const a=applications[0],geometry={type:"Point" as const,coordinates:[-116.4,43.6]};
 expect(sourceHash({...a,sourceFields:{...a.sourceFields,nested:{a:2,z:1}}})).toBe(sourceHash(a));
 expect(sourceHash({...a,sourceFields:{...a.sourceFields,nested:{a:2,z:3}}})).not.toBe(sourceHash(a));
 expect(sourceHash({...a,geometry})).not.toBe(sourceHash({...a,geometry:{...geometry,coordinates:[-116.5,43.6]}}));
 expect(sourceHash({...a,recordUrl:a.recordUrl+"/changed"})).not.toBe(sourceHash(a));
});
