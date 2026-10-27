import { Pool } from "pg";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { HearingMatchRow, HearingMeetingFields } from "./types";

const columns=["meeting_url","agenda_url","packet_url","meeting_body","meeting_datetime","agenda_item_number","comment_deadline","comment_deadline_source_url","speak_signup_url","last_checked_at"] as const;
let pool:Pool|undefined,ready:Promise<unknown>|undefined;
async function database() {
  pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});
  ready??=readFile(path.join(process.cwd(),"migrations/20261026_hearing_meetings.sql"),"utf8").then(sql=>pool!.query(sql)).catch(error=>{ready=undefined;throw error;});
  await ready;return pool;
}
const filename=()=>path.join(process.cwd(),".data","hearing-meetings.json");
const key=(area:string,id:string,hearing:string)=>[area,id,hearing].join("/");
async function localRows():Promise<Record<string,HearingMatchRow>> {
  try{return JSON.parse(await readFile(filename(),"utf8"));}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return {};throw error;}
}
async function writeLocal(rows:Record<string,HearingMatchRow>) {
  await mkdir(path.dirname(filename()),{recursive:true});const temporary=filename()+"."+randomUUID()+".tmp";
  await writeFile(temporary,JSON.stringify(rows));await rename(temporary,filename());
}
function rowData(row:Record<string,unknown>):HearingMatchRow {
  const data={...(row.metadata as HearingMeetingFields)};
  for(const column of columns)if(row[column]!=null)Object.assign(data,{[column]:row[column] instanceof Date?(row[column] as Date).toISOString():row[column]});
  const iso=(v:unknown)=>v instanceof Date?v.toISOString():v?String(v):undefined;
  return {areaId:String(row.area_id),caseId:String(row.case_id),hearingKey:String(row.hearing_key),data,override:row.manual_override as HearingMatchRow["override"],failureCount:Number(row.failure_count),lastAttemptAt:iso(row.last_attempt_at),nextAttemptAt:iso(row.next_attempt_at),lastError:row.last_error?String(row.last_error):undefined};
}
export async function readHearingMatch(area:string,caseId:string,hearing:string) {
  if(process.env.DATABASE_URL){const rows=(await(await database()).query("SELECT * FROM law_hearing_meetings WHERE area_id=$1 AND case_id=$2 AND hearing_key=$3",[area,caseId,hearing])).rows;return rows[0]?rowData(rows[0]):undefined;}
  return (await localRows())[key(area,caseId,hearing)];
}
export async function listHearingMatches():Promise<HearingMatchRow[]> {
  if(process.env.DATABASE_URL)return (await(await database()).query("SELECT * FROM law_hearing_meetings ORDER BY last_attempt_at DESC NULLS LAST LIMIT 100")).rows.map(rowData);
  return Object.values(await localRows()).sort((a,b)=>(b.lastAttemptAt??"").localeCompare(a.lastAttemptAt??"")).slice(0,100);
}
export async function saveHearingMatch(row:HearingMatchRow) {
  if(process.env.DATABASE_URL){
    const metadata=Object.fromEntries(Object.entries(row.data).filter(([field])=>!(columns as readonly string[]).includes(field)));
    const values=[row.areaId,row.caseId,row.hearingKey,...columns.map(c=>row.data[c]??null),JSON.stringify(metadata),JSON.stringify(row.override),row.failureCount,row.lastAttemptAt??null,row.nextAttemptAt??null,row.lastError??null];
    const names=["area_id","case_id","hearing_key",...columns,"metadata","manual_override","failure_count","last_attempt_at","next_attempt_at","last_error"];
    // Automatic sweeps cannot overwrite a simultaneous manual correction.
    const updates=names.filter(n=>!["area_id","case_id","hearing_key","manual_override"].includes(n)).map(n=>`${n}=excluded.${n}`).join(",");
    await(await database()).query(`INSERT INTO law_hearing_meetings(${names.join(",")}) VALUES(${values.map((_,i)=>"$"+(i+1)).join(",")}) ON CONFLICT(area_id,case_id,hearing_key) DO UPDATE SET ${updates}`,values);return;
  }
  const rows=await localRows(),id=key(row.areaId,row.caseId,row.hearingKey);rows[id]={...row,override:rows[id]?.override??row.override};await writeLocal(rows);
}
export async function saveHearingOverride(area:string,caseId:string,hearing:string,override:HearingMatchRow["override"]) {
  if(process.env.DATABASE_URL){await(await database()).query("INSERT INTO law_hearing_meetings(area_id,case_id,hearing_key,manual_override) VALUES($1,$2,$3,$4) ON CONFLICT(area_id,case_id,hearing_key) DO UPDATE SET manual_override=$4,failure_count=0,next_attempt_at=NULL,last_error=NULL",[area,caseId,hearing,JSON.stringify(override)]);return;}
  const rows=await localRows(),id=key(area,caseId,hearing);rows[id]={...(rows[id]??{areaId:area,caseId,hearingKey:hearing,data:{}}),override,failureCount:0};delete rows[id].nextAttemptAt;delete rows[id].lastError;await writeLocal(rows);
}
export function effectiveHearingFields(row:HearingMatchRow):HearingMeetingFields {
  const fields={...row.data} as Record<string,unknown>;
  for(const [name,value]of Object.entries(row.override)){
    if(value==null)delete fields[name];else fields[name]=value;
  }
  return fields as HearingMeetingFields;
}
