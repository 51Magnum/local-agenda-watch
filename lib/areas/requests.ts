import {databaseUrl} from "../runtime-environment";
import {liveAreasInRadius} from "@/lib/maps/radius";
import {Pool} from "../database-pool";
import {mkdir,readFile,writeFile,rename} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
export type CoverageRequest={radiusMiles?:number;jurisdictionScope?:"radius";jurisdictions?:string[];kind:"coverage"|"follow";areaRequested:string;location:{lat:number;lng:number}|null;email:string|null;createdAt:string;address?:string|null;interests?:string|null};
export type SavedCoverageRequest=CoverageRequest&{id?:string};
let pool:Pool|undefined,initialized:Promise<unknown>|undefined;
let writes:Promise<unknown>=Promise.resolve();
async function database(){
 pool??=new Pool({connectionString:databaseUrl(),max:2,connectionTimeoutMillis:10000});
 initialized??=(async()=>{
  await pool!.query("CREATE TABLE IF NOT EXISTS law_coverage_requests (id uuid PRIMARY KEY, kind text NOT NULL, area_requested text NOT NULL, latitude double precision, longitude double precision, email text, created_at timestamptz NOT NULL, address text, interests text)");
  // Existing waitlist entries are preserved; new fields are optional.
  await pool!.query("ALTER TABLE law_coverage_requests ADD COLUMN IF NOT EXISTS address text, ADD COLUMN IF NOT EXISTS interests text, ADD COLUMN IF NOT EXISTS radius_miles double precision");
  await pool!.query("CREATE INDEX IF NOT EXISTS law_coverage_requests_created_idx ON law_coverage_requests (created_at DESC)");
 })().catch(error=>{initialized=undefined;throw error;});
 await initialized;return pool;
}
const filename=()=>path.join(process.cwd(),".data","coverage-requests.json");
async function localRequests():Promise<SavedCoverageRequest[]>{try{return JSON.parse(await readFile(filename(),"utf8"));}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;return [];}}
export async function saveCoverageRequest(input:CoverageRequest){
 if(databaseUrl()){const db=await database();await db.query("INSERT INTO law_coverage_requests(id,kind,area_requested,latitude,longitude,email,created_at,radius_miles,address,interests) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[randomUUID(),input.kind,input.areaRequested,input.location?.lat??null,input.location?.lng??null,input.email,input.createdAt,input.location?input.radiusMiles??1:null,input.address??null,input.interests??null]);return;}
 if(process.env.VERCEL)throw new Error("Coverage request storage unavailable");
 const task=writes.catch(()=>{}).then(async()=>{await mkdir(path.dirname(filename()),{recursive:true});const items=await localRequests();items.push({...input,id:randomUUID()});const temporary=filename()+"."+randomUUID()+".tmp";await writeFile(temporary,JSON.stringify(items),{mode:0o600});await rename(temporary,filename());});writes=task;await task;
}
export async function listCoverageRequests(options:{kind?:"coverage"|"follow";page?:number}={}){
 const kind=options.kind==="coverage"||options.kind==="follow"?options.kind:undefined;
 const page=Math.max(1,Math.min(100000,Math.floor(options.page??1)||1)),pageSize=50,offset=(page-1)*pageSize;
 if(databaseUrl()){
  const db=await database();
  const [count,records]=await Promise.all([
   db.query("SELECT count(*)::int AS all, (count(*) FILTER (WHERE kind='follow'))::int AS follow, (count(*) FILTER (WHERE kind='coverage'))::int AS coverage FROM law_coverage_requests"),
   db.query("SELECT id,kind,area_requested,latitude,longitude,email,created_at,address,interests,radius_miles FROM law_coverage_requests WHERE ($1::text IS NULL OR kind=$1) ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3",[kind??null,pageSize,offset])
  ]);
  const counts=count.rows[0] as {all:number;follow:number;coverage:number};
  const items:SavedCoverageRequest[]=records.rows.map(row=>({id:row.id,kind:row.kind,areaRequested:row.area_requested,email:row.email,address:row.address,interests:row.interests,createdAt:new Date(row.created_at).toISOString(),radiusMiles:row.radius_miles??1,location:row.latitude!=null&&row.longitude!=null?{lat:row.latitude,lng:row.longitude}:null}));
  return {items:items.map(withRadiusScope),counts,total:kind?counts[kind]:counts.all,page,pageSize};
 }
 if(process.env.VERCEL)throw new Error("Coverage request storage unavailable");
 await writes;
 const all=await localRequests(),counts={all:all.length,follow:all.filter(x=>x.kind==="follow").length,coverage:all.filter(x=>x.kind==="coverage").length};
 const filtered=all.filter(x=>!kind||x.kind===kind).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return {items:filtered.slice(offset,offset+pageSize).map(withRadiusScope),counts,total:filtered.length,page,pageSize};
}

/** Resolve on use, so newly live jurisdictions join an existing saved radius automatically. */
export function withRadiusScope<T extends CoverageRequest>(request:T):T{
 if(request.kind!=="follow"||!request.location)return request;
 const radiusMiles=request.radiusMiles??1;
 return {...request,radiusMiles,jurisdictionScope:"radius",jurisdictions:liveAreasInRadius([request.location.lng,request.location.lat],radiusMiles).map(a=>a.id)};
}
