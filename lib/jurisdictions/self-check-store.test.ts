import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
import {expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({db:undefined as unknown as PGlite}));
vi.mock("./store",()=>({jurisdictionDb:async()=>h.db,jurisdictionTransaction:async(work:(db:PGlite)=>Promise<unknown>)=>h.db.transaction(tx=>work(tx as unknown as PGlite))}));
vi.mock("../runtime-environment",()=>({databaseUrl:()=>"fixture",requireOnboardingMutation:()=>{}}));
import {persistSelfCheck,readPublished,pauseJurisdiction,publicationSnapshot} from "./self-check-store";
import {selfCheck} from "./self-check";
import {jurisdiction} from "./registry";
import type {StagingSnapshot} from "./store";
it("records automatic approval atomically, removes failing records, blocks new records below threshold, and pauses",async()=>{
 h.db=new PGlite();try{
  await h.db.exec(readFileSync("migrations/20261027_jurisdiction_onboarding.up.sql","utf8"));await h.db.exec(readFileSync("migrations/20261031_self_check.up.sql","utf8"));
  const d={...jurisdiction("ada-county"),selfCheck:{minPassRate:.95}},description="Conditional Use for a contractor yard";
  const a={recordId:"202600934-S",relatedCaseNumbers:[],projectNumber:"202600934",type:"Conditional Use",description,name:description,address:"",status:"Active",parcel:[],recordUrl:"https://official.test/202600934",sourceUrl:"https://official.test/202600934",sourceFields:{AppApplicDesc:description}};
  const s:StagingSnapshot={areaId:d.id,launchStatus:"admin_only",applications:[a],meetings:[],checkedAt:"2026-10-31",range:{start:"2026-08-01",end:"2026-11-01"},complete:true,health:[],skipped:[]};
  await h.db.query("INSERT INTO law_jurisdiction_snapshots VALUES($1,$2,$3,now())",[d.id,"admin_only",JSON.stringify(s)]);
  const report=await selfCheck(d,s,{links:async()=>({status:200,text:"202600934"})});expect(report.goLive).toBe(true);await persistSelfCheck(s,report);expect((await readPublished(d.id))?.applications).toHaveLength(1);
  expect((await h.db.query<{admin_user:string}>("SELECT admin_user FROM law_jurisdiction_approvals")).rows[0].admin_user).toBe("self-check");
  const failed={...report,goLive:false,passRate:0,records:report.records.map(r=>({...r,publish:false}))};expect(publicationSnapshot(s,failed,s).applications).toHaveLength(0);
  expect(publicationSnapshot(s,{...report,goLive:false},{...s,applications:[]}).applications).toHaveLength(0);
  await pauseJurisdiction(d.id,"admin");expect(await readPublished(d.id)).toBeUndefined();await persistSelfCheck(s,report);expect(await readPublished(d.id)).toBeUndefined();
  await expect(persistSelfCheck({...s,applications:[]},report)).rejects.toThrow("match snapshot");
 }finally{await h.db.close();}
});
