import {readFileSync} from "node:fs";
import {afterEach,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {structuredResponse} from "./extract";
import {aiBudget,createBudgetLedger} from "../ai-budget";
import {jurisdictionAiBudget,withJurisdictionAi,createJurisdictionBudget} from "../jurisdictions/ai-budget";
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it.each(["throw","non-OK","timeout"])("settles both reservations at zero after provider %s",async failure=>{
 vi.stubEnv("OPENAI_API_KEY","fixture");
 const globalId="00000000-0000-4000-8000-000000000001",areaId="00000000-0000-4000-8000-000000000002";
 vi.spyOn(aiBudget,"reserve").mockResolvedValue(globalId);vi.spyOn(jurisdictionAiBudget,"reserve").mockResolvedValue(areaId);
 const global=vi.spyOn(aiBudget,"settle").mockResolvedValue(0),area=vi.spyOn(jurisdictionAiBudget,"settle").mockResolvedValue(0);
 const fetch=vi.fn();if(failure==="non-OK")fetch.mockResolvedValue(Response.json({error:{code:"rate_limit_exceeded"}},{status:429}));else fetch.mockRejectedValue(failure==="timeout"?new DOMException("Timed out","TimeoutError"):new Error("Network failed"));vi.stubGlobal("fetch",fetch);
 await expect(withJurisdictionAi({areaId:"ada-county",mode:"backfill"},()=>structuredResponse("fixture",{},[{type:"input_text",text:"Official source"}],"Extract"))).rejects.toThrow();
 expect(global).toHaveBeenCalledExactlyOnceWith(globalId,"gpt-4.1-mini",{});expect(area).toHaveBeenCalledExactlyOnceWith(areaId,"gpt-4.1-mini",{});
});
it("releases hour-old global reservations atomically and only once",async()=>{
 const db=new PGlite();try{
  const ledger=createBudgetLedger(async(sql,values)=>values?.length?db.query(sql,values):(await db.exec(sql)).at(-1)!);
  const first=await ledger.reserve("fixture","gpt-4.1-mini",.006,.01);
  await db.query("UPDATE law_ai_calls SET created_at=now()-interval '2 hours' WHERE id=$1",[first]);
  await ledger.reserve("fixture","gpt-4.1-mini",.006,.01);await ledger.reconcile();
  const total=await ledger.today();expect(total.reserved).toBeCloseTo(.006);expect(total.spent).toBe(0);
  expect((await db.query<{cost:number}>("SELECT cost FROM law_ai_calls WHERE id=$1",[first])).rows[0].cost).toBe("0");
 }finally{await db.close();}
});
it("reconciles stale jurisdiction reservations across every bucket while preserving fresh calls",async()=>{
 const db=new PGlite();try{
  await db.exec(readFileSync("migrations/20261027_jurisdiction_onboarding.up.sql","utf8"));
  const ledger=createJurisdictionBudget(async work=>db.transaction(async tx=>work({query:async(sql:string,values?:unknown[])=>sql.includes("pg_advisory_xact_lock")?{rows:[]}:tx.query(sql,values)} as never))),work={areaId:"ada-county",mode:"backfill" as const,sample:{id:"fixture",maxUsd:1}};
  const first=await ledger.reserve(work,.6);await db.query("UPDATE law_jurisdiction_ai_calls SET created_at=now()-interval '2 hours' WHERE id=$1",[first]);
  await ledger.reserve(work,.6);expect(await ledger.reconcile(work.areaId)).toBe(0);
  const rows=(await db.query<{reserved:number;spent:number}>("SELECT reserved,spent FROM law_jurisdiction_ai_budgets")).rows;
  expect(rows).toHaveLength(3);expect(rows.every(r=>Number(r.reserved)===.6&&Number(r.spent)===0)).toBe(true);
 }finally{await db.close();}
});
