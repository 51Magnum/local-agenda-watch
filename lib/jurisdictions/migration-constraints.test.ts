import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
it("repairs runtime-created tables idempotently and rolls back only the additive constraints",async()=>{
 const db=new PGlite();try{
  await db.exec("CREATE TABLE law_jurisdiction_snapshots(area_id text PRIMARY KEY,launch_status text NOT NULL,data jsonb);CREATE TABLE law_jurisdiction_approvals(id text PRIMARY KEY,admin_user text NOT NULL CHECK(admin_user<>'forbidden'));CREATE TABLE law_jurisdiction_ai_budgets(area_id text PRIMARY KEY,spent numeric NOT NULL DEFAULT 0,reserved numeric NOT NULL DEFAULT 0);INSERT INTO law_jurisdiction_snapshots VALUES('ada-county','admin_only','{}');");
  const up=readFileSync("migrations/20261028_onboarding_constraints.up.sql","utf8"),down=readFileSync("migrations/20261028_onboarding_constraints.down.sql","utf8");
  await db.exec(up);await db.exec(up);
  await expect(db.query("INSERT INTO law_jurisdiction_snapshots VALUES('bad','unknown','{}')")).rejects.toThrow();
  await expect(db.query("INSERT INTO law_jurisdiction_approvals VALUES('bad','   ')")).rejects.toThrow();
  await expect(db.query("INSERT INTO law_jurisdiction_ai_budgets VALUES('bad',-1,0)")).rejects.toThrow();
  await expect(db.query("INSERT INTO law_jurisdiction_ai_budgets VALUES('bad',0,-1)")).rejects.toThrow();
  await db.exec(down);await db.exec(down);
  await expect(db.query("INSERT INTO law_jurisdiction_approvals VALUES('allowed','')")).resolves.toBeDefined();
  await expect(db.query("INSERT INTO law_jurisdiction_approvals VALUES('bad','forbidden')")).rejects.toThrow();
  expect((await db.query("SELECT area_id FROM law_jurisdiction_snapshots")).rows).toEqual([{area_id:"ada-county"}]);
  expect(readFileSync("lib/jurisdictions/store.ts","utf8")).not.toContain("CREATE TABLE");
 }finally{await db.close();}
});
