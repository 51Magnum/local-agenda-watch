import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {applyOnboardingMigrations} from "./migrations";
it("automatically applies the deploy migrations twice without changing the schema",async()=>{
 const db=new PGlite();try{
  const client={query:async(sql:string,params?:unknown[])=>{
   if(sql.includes("pg_advisory_xact_lock"))return {rows:[]};
   if(params)return db.query(sql,params);
   await db.exec(sql);return {rows:[]};
  }} as unknown as Parameters<typeof applyOnboardingMigrations>[0];
  await applyOnboardingMigrations(client);await applyOnboardingMigrations(client);
  expect((await db.query("SELECT id FROM law_schema_migrations")).rows).toHaveLength(3);
  expect((await db.query("SELECT * FROM law_jurisdiction_exceptions")).rows).toHaveLength(0);
  await db.exec(readFileSync("migrations/20261031_self_check.down.sql","utf8"));
  expect((await db.query("SELECT id FROM law_schema_migrations")).rows).toHaveLength(2);
  await applyOnboardingMigrations(client);
  expect((await db.query("SELECT id FROM law_schema_migrations")).rows).toHaveLength(3);
  expect((await db.query("SELECT * FROM law_jurisdiction_exceptions")).rows).toHaveLength(0);
 }finally{await db.close();}
});
