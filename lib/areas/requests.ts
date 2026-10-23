import {Pool}from"pg";
import{mkdir,readFile,writeFile,rename}from"node:fs/promises";
import path from"node:path";
import{randomUUID}from"node:crypto";
export type CoverageRequest={kind:"coverage"|"follow";areaRequested:string;location:{lat:number;lng:number}|null;email:string|null;createdAt:string};
let pool:Pool|undefined,initialized:Promise<unknown>|undefined;
let writes:Promise<unknown>=Promise.resolve();
export async function saveCoverageRequest(input:CoverageRequest){
  if(process.env.DATABASE_URL){pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});initialized??=pool.query("CREATE TABLE IF NOT EXISTS law_coverage_requests (id uuid PRIMARY KEY, kind text NOT NULL, area_requested text NOT NULL, latitude double precision, longitude double precision, email text, created_at timestamptz NOT NULL)").catch(e=>{initialized=undefined;throw e;});await initialized;await pool.query("INSERT INTO law_coverage_requests(id,kind,area_requested,latitude,longitude,email,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",[randomUUID(),input.kind,input.areaRequested,input.location?.lat??null,input.location?.lng??null,input.email,input.createdAt]);return;}
  if(process.env.VERCEL)throw new Error("Coverage request storage unavailable");
  const filename=path.join(process.cwd(),".data","coverage-requests.json");
  const task=writes.catch(()=>{}).then(async()=>{await mkdir(path.dirname(filename),{recursive:true});let items:CoverageRequest[]=[];try{items=JSON.parse(await readFile(filename,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}items.push(input);const temporary=filename+"."+randomUUID()+".tmp";await writeFile(temporary,JSON.stringify(items),{mode:0o600});await rename(temporary,filename);});writes=task;await task;
}
