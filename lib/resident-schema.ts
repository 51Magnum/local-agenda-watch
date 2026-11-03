import "server-only";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
import type {Pool} from "pg";
import {PAID_PIN_LIMIT} from "./plan-policy";

/** Called by the existing alert pool, before any account or scheduled alert work. */
export async function applyResidentSchema(db: Pick<Pool,"connect">) {
 const client=await db.connect();
 try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('law:resident-login:schema'))");
  await client.query(await readFile(path.join(process.cwd(),"migrations/20261103_resident_login.up.sql"),"utf8"));
  await client.query("CREATE TABLE IF NOT EXISTS law_schema_migrations(id text PRIMARY KEY,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
  const file="20261103_profile_plan_tiers.up.sql",sql=await readFile(path.join(process.cwd(),"migrations",file),"utf8"),hash=createHash("sha256").update(sql.replace(/\r\n/g,"\n")).digest("hex");
  const old=await client.query("SELECT hash FROM law_schema_migrations WHERE id=$1",[file]);
  if(old.rows.length){if(old.rows[0].hash!==hash)throw Error("Applied resident migration changed");}
  else {await client.query(sql);await client.query("INSERT INTO law_schema_migrations(id,hash) VALUES($1,$2)",[file,hash]);}
  await client.query("INSERT INTO law_resident_plan_policy(id,paid_pin_limit) VALUES(true,$1) ON CONFLICT(id) DO UPDATE SET paid_pin_limit=excluded.paid_pin_limit",[PAID_PIN_LIMIT]);
  await client.query("COMMIT");
 } catch(error){await client.query("ROLLBACK");throw error;} finally {client.release();}
}
