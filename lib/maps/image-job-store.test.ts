import {expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
const harness=vi.hoisted(()=>({db:null as unknown}));
vi.mock("pg",()=>({Pool:class{async query(sql:string,params?:unknown[]){const db=harness.db as PGlite;const r=await db.query(sql,params);return {...r,rowCount:r.affectedRows??r.rows.length};}}}));
import {enqueueImages,claimImageJob,saveImageJob,rescanCase,imageJobs} from "./image-job-store";
it("leases one case at a time, checkpoints only that row, and resets discovery on rescan",async()=>{
 const db=new PGlite();harness.db=db;vi.stubEnv("DATABASE_URL","postgres://test");
 try{await enqueueImages([{areaId:"nampa",caseId:"ONE"},{areaId:"nampa",caseId:"TWO"}]);const first=await claimImageJob(),second=await claimImageJob();expect(first?.caseId).toBe("ONE");expect(second?.caseId).toBe("TWO");expect(await claimImageJob()).toBeUndefined();
 first!.status="complete";first!.discoveryComplete=true;first!.dueAt=new Date(Date.now()+86400000).toISOString();await saveImageJob(first!,true);await rescanCase("nampa","ONE");const again=await claimImageJob({areaId:"nampa",caseId:"ONE"});expect(again?.discoveryComplete).toBe(false);expect(again?.status).toBe("pending");expect((await imageJobs()).length).toBe(2);
 }finally{vi.unstubAllEnvs();await db.close();}
},15000); // Includes cold PGlite WASM startup on shared CI runners.
