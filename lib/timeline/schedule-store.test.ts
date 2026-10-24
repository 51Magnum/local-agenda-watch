import {expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
const harness=vi.hoisted(()=>({db:undefined as unknown as PGlite,results:[] as unknown[][]}));
vi.mock("pg",()=>({Pool:class {
 async query(sql:string,params:unknown[]=[]){
  if(sql.startsWith("CREATE TABLE")){await harness.db.exec(sql);return {rows:[],rowCount:0};}
  const r=await harness.db.query(sql,params);harness.results.push(r.rows);return {...r,rowCount:r.affectedRows??r.rows.length};
 }
}}));
import {claimSchedule,readSchedule,releaseSchedule,scheduleDue} from "./schedule-store";
import {emptySchedule} from "./schedule";
it("stores the index separately, returns one boolean on idle runs, and leases without timeline reads",async()=>{
 const db=new PGlite();harness.db=db;vi.stubEnv("DATABASE_URL","test");
 try{
  expect(await scheduleDue("2026-10-20:pm","pm",[{areaId:"nampa",today:"2026-10-20"}])).toBe(false);
  expect(await scheduleDue("2026-10-20:am","am",[])).toBe(true);
  const token=await claimSchedule();expect(token).toBeTruthy();expect(await claimSchedule()).toBeNull();
  await releaseSchedule(token!,{...emptySchedule(),meetings:[{id:"m",areaId:"nampa",body:"City Council",date:"2026-10-19",caseIds:["CASE"],resolvedCaseIds:[]}]});
  expect((await readSchedule()).meetings).toHaveLength(1);
  expect(await scheduleDue("2026-10-20:pm","pm",[{areaId:"nampa",today:"2026-10-20"}])).toBe(true);
  expect(harness.results.at(-1)).toEqual([{due:true}]);
  expect(await scheduleDue("2026-10-21:pm","pm",[{areaId:"nampa",today:"2026-10-21"}])).toBe(false);
  expect(await scheduleDue("2026-10-18:pm","pm",[{areaId:"nampa",today:"2026-10-18"}])).toBe(true);
  const second=await claimSchedule();const state=await readSchedule();state.meetings[0].resolvedCaseIds=["CASE"];state.slots["2026-10-18:pm"]="done";await releaseSchedule(second!,state);
  expect(await scheduleDue("2026-10-20:pm","pm",[{areaId:"nampa",today:"2026-10-20"}])).toBe(false);
  expect(await scheduleDue("2026-10-18:pm","pm",[{areaId:"nampa",today:"2026-10-18"}])).toBe(false);
 }finally{vi.unstubAllEnvs();await db.close();}
});
