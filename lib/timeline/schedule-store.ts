import {Pool} from "pg";
import {randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile,rename,rm} from "node:fs/promises";
import path from "node:path";
import {emptySchedule,type ScheduleState} from "./schedule";
let pool:Pool|undefined,ready:Promise<unknown>|undefined;
const filename=()=>path.join(process.cwd(),".data","timeline-schedule.json");
/** Returns one boolean, not the meeting index, on idle afternoon / duplicate invocations. */
export async function scheduleDue(slot:string,period:string,dates:{areaId:string;today:string}[]):Promise<boolean>{
 if(!process.env.DATABASE_URL)return true;
 const db=await database();
 const result=await db.query(`SELECT NOT coalesce(data->'slots' ? $1,false) AND ($2='am' OR EXISTS (
  SELECT 1 FROM jsonb_array_elements(data->'meetings') m,
   jsonb_to_recordset($3::jsonb) AS a("areaId" text,today date)
  WHERE m->>'areaId'=a."areaId" AND (
   (m->>'date')::date=a.today+1 OR ((m->>'date')::date=a.today-1 AND EXISTS(
    SELECT 1 FROM jsonb_array_elements_text(m->'caseIds') c WHERE NOT coalesce(m->'resolvedCaseIds','[]'::jsonb) ? c))))
 ) AS due FROM law_timeline_schedule WHERE id='meetings'`,[slot,period,JSON.stringify(dates)]);
 return result.rows[0]?.due??period==="am";
}
async function database(){
 const db=pool??=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
 ready??=db.query("CREATE TABLE IF NOT EXISTS law_timeline_schedule(id text PRIMARY KEY,data jsonb NOT NULL,lease_token text,lease_until timestamptz)").catch(error=>{ready=undefined;throw error;});
 await ready;return db;
}
export async function readSchedule():Promise<ScheduleState>{
 if(process.env.DATABASE_URL){const db=await database();return (await db.query("SELECT data FROM law_timeline_schedule WHERE id='meetings'")).rows[0]?.data??emptySchedule();}
 if(process.env.VERCEL)throw new Error("DATABASE_URL is required for scheduling");
 try{return JSON.parse(await readFile(filename(),"utf8"));}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return emptySchedule();throw error;}
}
export async function claimSchedule(){
 const token=randomUUID();
 if(process.env.DATABASE_URL){const db=await database();const result=await db.query(`INSERT INTO law_timeline_schedule(id,data,lease_token,lease_until) VALUES ('meetings',$1,$2,now()+interval '10 minutes') ON CONFLICT(id) DO UPDATE SET lease_token=$2,lease_until=now()+interval '10 minutes' WHERE law_timeline_schedule.lease_until IS NULL OR law_timeline_schedule.lease_until<now() RETURNING id`,[JSON.stringify(emptySchedule()),token]);return result.rowCount?token:null;}
 await mkdir(path.dirname(filename()),{recursive:true});
 try{await writeFile(filename()+".lease",token,{flag:"wx",mode:0o600});return token;}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")return null;throw error;}
}
export async function releaseSchedule(token:string,state?:ScheduleState){
 if(process.env.DATABASE_URL){const db=await database();await db.query("UPDATE law_timeline_schedule SET data=coalesce($2::jsonb,data),lease_token=NULL,lease_until=NULL WHERE id='meetings' AND lease_token=$1",[token,state?JSON.stringify(state):null]);return;}
 if(await readFile(filename()+".lease","utf8")!==token)return;
 if(state){const temporary=filename()+"."+token+".tmp";await writeFile(temporary,JSON.stringify(state),{mode:0o600});await rename(temporary,filename());}
 await rm(filename()+".lease",{force:true});
}
