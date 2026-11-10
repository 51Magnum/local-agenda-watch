import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "../lib/database-pool";
import { databaseUrl } from "../lib/runtime-environment";
import type { Subscription } from "../lib/alerts";
import { denverInstant } from "../lib/case-details";
import { previewWatch } from "../lib/email/dry-run";
import type { MapCase } from "../lib/maps/types";

async function main() {
process.env.LAW_READ_ONLY="true";
process.env.ALERTS_DELIVERY_ENABLED="false";
const args=process.argv.slice(2),arg=(key:string)=>args[args.indexOf(key)+1];
if(args.includes("--help")){console.log("Usage: npm run alerts:dry-run -- --watch <subscription UUID> --date YYYY-MM-DD [--output output/alerts-dry-run]\nBuilds current records only; never sends email or advances subscriber state.");process.exit(0);}
if(!args.includes("--watch"))throw Error("Usage: npm run alerts:dry-run -- --watch <subscription UUID> --date YYYY-MM-DD [--output output/alerts-dry-run]");
const id=arg("--watch");if(!/^[a-f0-9-]{36}$/i.test(id))throw Error("Watch must be a subscription UUID");
const scope=args.includes("--scope")?arg("--scope"):"production";
const date=args.includes("--date")?arg("--date"):undefined;
if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Date must be YYYY-MM-DD (America/Denver)");
const now=date?new Date(denverInstant(date,"12:00","America/Denver")):new Date();
if(date&&new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver"}).format(now)!==date)throw Error("Date is not a valid calendar day");
if(!databaseUrl())throw Error("DATABASE_URL is required to read the watch and current records");
const db=new Pool({connectionString:databaseUrl(),max:1,idleTimeoutMillis:1000});
try {
  const readOnly=(await db.query("SHOW default_transaction_read_only")).rows[0]?.default_transaction_read_only;
  if(readOnly!=="on")throw Error("Dry run requires server-enforced read-only transactions");
  // SELECT only. Do not initialize alert tables or advance watch/delivery state.
  const sub=(await db.query(`SELECT s.id,s.state,CASE WHEN s.target->>'kind'='place' THEN jsonb_build_object('kind','place','label',p.label,'coordinates',jsonb_build_array(p.longitude,p.latitude),'radiusMiles',p.radius_miles) ELSE s.target END AS target FROM law_alert_subscriptions s LEFT JOIN law_resident_pins p ON p.subscription_id=s.id AND NOT p.archived WHERE s.id=$1 AND s.scope=$2 AND (s.target->>'kind'<>'place' OR p.id IS NOT NULL)`,[id,scope])).rows[0] as Subscription|undefined;
  if(!sub)throw Error("Watch not found in the current environment scope");
  const rows=(await db.query(`SELECT area_id AS "areaId",data-'visual'-'popup' AS data FROM law_map_cases`)).rows.map(r=>({...r.data,areaId:r.areaId})) as MapCase[];
  const result=await previewWatch(sub,rows,now);
  const output=resolve(args.includes("--output")?arg("--output"):"output/alerts-dry-run");await mkdir(output,{recursive:true});
  await writeFile(resolve(output,"report.json"),JSON.stringify({at:result.at,readOnly:true,scope,watchId:id,items:result.report},null,2));
  for(const [index,message] of result.messages.entries())for(const format of ["html","text"] as const)await writeFile(resolve(output,`digest-${index+1}.${format==="text"?"txt":"html"}`),message[format]);
  console.log(JSON.stringify({at:result.at,readOnly:true,scope,watchId:id,items:result.report,messages:result.messages.length,output},null,2));
} finally { await db.end(); }

}
main().catch(error=>{console.error(error instanceof Error?error.message:"Dry run failed");process.exitCode=1;});
