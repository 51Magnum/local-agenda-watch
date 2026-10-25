import {expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
const harness=vi.hoisted(()=>({db:null as unknown as PGlite}));
vi.mock("pg",()=>({Pool:class{async query(sql:string,values?:unknown[]){return values?.length?await harness.db.query(sql,values):(await harness.db.exec(sql)).at(-1);}}}));
import {saveCorrection,readCorrections,updateCorrection} from "./corrections";
it("atomically permits only five reports per IP/hour and keeps raw IPs out of stored rows",async()=>{
 const db=new PGlite();harness.db=db;vi.stubEnv("DATABASE_URL","test");const log=vi.spyOn(console,"info").mockImplementation(()=>{});
 try{
  const input={project:"meridian/H-2026-0047",message:"Test correction",email:null};
  const result=await Promise.all(Array.from({length:7},()=>saveCorrection(input,"203.0.113.2",new Date("2026-10-25T12:15:00Z"))));
  expect(result.filter(r=>!r.limited)).toHaveLength(5);expect(result.filter(r=>r.limited)).toHaveLength(2);
  const rows=await readCorrections();expect(rows).toHaveLength(5);await updateCorrection(rows[0].id,"resolved");expect((await readCorrections()).some(r=>r.status==="resolved")).toBe(true);
  const limits=await db.query("SELECT * FROM law_correction_limits");expect(JSON.stringify(limits.rows)).not.toContain("203.0.113.2");
 }finally{log.mockRestore();vi.unstubAllEnvs();await db.close();}
});
