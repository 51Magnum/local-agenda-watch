import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {budgetBuckets,createJurisdictionBudget} from "./ai-budget";
it.each(["nampa","meridian","canyon-county","kuna","eagle","star","middleton"])("exempts %s from unmeasured per-area caps while retaining sample caps",areaId=>{
 const buckets=budgetBuckets({areaId,mode:"backfill",sample:{id:"fixture",maxUsd:1}});expect(buckets.map(b=>b.limit)).toEqual([Infinity,Infinity,1]);
});
it("records live-area spend reservations beyond the old $15 cap without deferring work",async()=>{
 const db=new PGlite();try{
  await db.exec(readFileSync("migrations/20261027_jurisdiction_onboarding.up.sql","utf8"));
  const ledger=createJurisdictionBudget(async work=>db.transaction(async tx=>work({query:async(sql:string,values?:unknown[])=>sql.includes("pg_advisory_xact_lock")?{rows:[]}:tx.query(sql,values)} as never)));
  await expect(ledger.reserve({areaId:"nampa",mode:"monthly"},16)).resolves.toBeTruthy();
  await expect(ledger.reserve({areaId:"nampa",mode:"monthly",sample:{id:"sample",maxUsd:1}},1.1)).rejects.toThrow("dollar cap");
  expect(Number((await db.query<{reserved:number}>("SELECT reserved FROM law_jurisdiction_ai_budgets WHERE area_id='nampa'")).rows[0].reserved)).toBe(16);
 }finally{await db.close();}
},15000); // Includes cold PGlite WASM startup on shared CI runners.
