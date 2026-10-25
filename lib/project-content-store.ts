import {Pool} from "pg";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import path from "node:path";
export type ProjectContent={fingerprint:string;headline:string;explanation?:string;aiGenerated:boolean;status:"ready"|"fallback"|"deferred";checkedAt:string;source?:{url:string;page:number};impacts:{label:string;value:string;url:string}[]};
let pool:Pool|undefined,ready:Promise<unknown>|undefined;
async function db(){pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});ready??=pool.query("CREATE TABLE IF NOT EXISTS law_project_content(area_id text NOT NULL,case_id text NOT NULL,data jsonb NOT NULL,PRIMARY KEY(area_id,case_id))");await ready;return pool;}
const file=()=>path.join(process.cwd(),".data","project-content.json");
async function local():Promise<Record<string,ProjectContent>>{try{return JSON.parse(await readFile(file(),"utf8"));}catch{return {};}}
export async function readProjectContent(areaId:string,caseIds:string[]){if(!caseIds.length)return {};if(process.env.DATABASE_URL)return Object.fromEntries((await(await db()).query("SELECT case_id,data FROM law_project_content WHERE area_id=$1 AND case_id=ANY($2::text[])",[areaId,caseIds])).rows.map(r=>[r.case_id,r.data])) as Record<string,ProjectContent>;const rows=await local();return Object.fromEntries(caseIds.filter(id=>rows[areaId+"/"+id]).map(id=>[id,rows[areaId+"/"+id]]));}
export async function saveProjectContent(areaId:string,caseId:string,data:ProjectContent){if(process.env.DATABASE_URL){await(await db()).query("INSERT INTO law_project_content VALUES($1,$2,$3) ON CONFLICT(area_id,case_id) DO UPDATE SET data=excluded.data WHERE law_project_content.data IS DISTINCT FROM excluded.data",[areaId,caseId,JSON.stringify(data)]);return;}const rows=await local();rows[areaId+"/"+caseId]=data;await mkdir(path.dirname(file()),{recursive:true});await writeFile(file(),JSON.stringify(rows));}
