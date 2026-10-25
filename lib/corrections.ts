import {Pool} from "pg";
import {createHash,randomUUID} from "node:crypto";
let pool:Pool,ready:Promise<unknown>|undefined;
async function db(){
 if(!process.env.DATABASE_URL)throw Error("Corrections storage not configured");
 pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});
 ready??=pool.query(`CREATE TABLE IF NOT EXISTS law_corrections(id uuid PRIMARY KEY,project text NOT NULL,message text NOT NULL,email text,created_at timestamptz NOT NULL DEFAULT now(),status text NOT NULL DEFAULT 'new');CREATE TABLE IF NOT EXISTS law_correction_limits(ip_hash text NOT NULL,window_start timestamptz NOT NULL,hits int NOT NULL,PRIMARY KEY(ip_hash,window_start));`).catch(e=>{ready=undefined;throw e;});
 await ready;return pool;
}
export async function saveCorrection(input:{project:string;message:string;email:string|null},ip:string,now=new Date()){
 const database=await db(),bucket=new Date(now);bucket.setUTCMinutes(0,0,0);
 const hash=createHash("sha256").update((process.env.REVIEW_ADMIN_PASSWORD??"corrections-rate-limit")+bucket.toISOString()+ip).digest("hex");
 const rate=await database.query("INSERT INTO law_correction_limits VALUES($1,$2,1) ON CONFLICT(ip_hash,window_start) DO UPDATE SET hits=law_correction_limits.hits+1 WHERE law_correction_limits.hits<5 RETURNING hits",[hash,bucket.toISOString()]);
 if(!rate.rows.length)return {limited:true};
 const id=randomUUID();await database.query("INSERT INTO law_corrections(id,project,message,email,created_at) VALUES($1,$2,$3,$4,$5)",[id,input.project,input.message,input.email,now.toISOString()]);
 await database.query("DELETE FROM law_correction_limits WHERE window_start<now()-interval '2 hours'");
 console.info("[corrections:received]",JSON.stringify({id,project:input.project,mail:"No mail helper configured; review /admin/corrections"}));return {limited:false,id};
}
export async function readCorrections(){return(await(await db()).query("SELECT id,project,message,email,created_at,status FROM law_corrections ORDER BY created_at DESC LIMIT 100")).rows;}
export async function updateCorrection(id:string,status:string){await(await db()).query("UPDATE law_corrections SET status=$2 WHERE id=$1",[id,status]);}
