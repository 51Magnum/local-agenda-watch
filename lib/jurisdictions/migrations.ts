import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
import type {PoolClient} from "pg";
import {requireProductionMutation} from "../runtime-environment";
import {jurisdictionDb} from "./store";
const files=["20261027_jurisdiction_onboarding.up.sql","20261028_onboarding_constraints.up.sql","20261031_self_check.up.sql"];
/** Reuses the existing SQL migration files, atomically, under one database lock. */
export async function applyOnboardingMigrations(client:Pick<PoolClient,"query">){
 await client.query("BEGIN");
 try{
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",["law:onboarding:migrations"]);
  await client.query("CREATE TABLE IF NOT EXISTS law_schema_migrations(id text PRIMARY KEY,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
  for(const file of files){const sql=await readFile(path.join(process.cwd(),"migrations",file),"utf8"),hash=createHash("sha256").update(sql.replace(/\r\n/g,"\n")).digest("hex"),old=await client.query("SELECT hash FROM law_schema_migrations WHERE id=$1",[file]);
   if(old.rows.length){if(old.rows[0].hash!==hash)throw Error("Applied migration changed: "+file);continue;}
   await client.query(sql.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gmi,""));
   await client.query("INSERT INTO law_schema_migrations(id,hash) VALUES($1,$2)",[file,hash]);
  }
  await client.query("COMMIT");
 }catch(error){await client.query("ROLLBACK");throw error;}
}
let ready:Promise<void>|undefined;
export async function ensureOnboardingSchema(){
 requireProductionMutation();if(!process.env.VERCEL)throw Error("Automatic migrations run only in deployed production");
 ready??=(async()=>{const client=await(await jurisdictionDb()).connect();try{await applyOnboardingMigrations(client);}finally{client.release();}})().catch(error=>{ready=undefined;throw error;});
 return ready;
}
