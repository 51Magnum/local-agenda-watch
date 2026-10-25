import { Pool } from "pg";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { MapVisual } from "./types";
import { approvedImageCheck, imageCheckExpired, type ImageCheck } from "./image-policy";
export type ImageReview = { id:string; areaId:string; caseIds:string[]; title:string; sourceUrl:string; originalSrc:string; outcome:"accepted"|"rejected"|"blocked"|"withdrawn"; reason?:string; hidden?:boolean; manual?:boolean; selected?:boolean;documentDate?:string; visual?:MapVisual; checkedAt:string };
let pool:Pool|undefined,ready:Promise<unknown>|undefined;
async function database(){pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});ready??=pool.query("CREATE TABLE IF NOT EXISTS law_image_checks(id text PRIMARY KEY,data jsonb NOT NULL);CREATE TABLE IF NOT EXISTS law_image_reviews(id text PRIMARY KEY,area_id text NOT NULL,case_ids text[] NOT NULL,data jsonb NOT NULL)");await ready;return pool;}
const file=()=>path.join(process.cwd(),".data","image-reviews.json");
type Local={checks:Record<string,ImageCheck>;reviews:Record<string,ImageReview>};
async function local():Promise<Local>{try{return JSON.parse(await readFile(file(),"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;return {checks:{},reviews:{}};}}
let queue=Promise.resolve();
function mutate(work:(data:Local)=>void){const task=queue.then(async()=>{const data=await local();work(data);await mkdir(path.dirname(file()),{recursive:true});const tmp=file()+"."+randomUUID()+".tmp";await writeFile(tmp,JSON.stringify(data));await rename(tmp,file());});queue=task.catch(()=>{});return task;}
export async function readImageCheck(id:string):Promise<ImageCheck|undefined>{if(process.env.DATABASE_URL)return(await(await database()).query("SELECT data FROM law_image_checks WHERE id=$1",[id])).rows[0]?.data;return(await local()).checks[id];}
export async function saveImageCheck(id:string,data:ImageCheck){if(process.env.DATABASE_URL){await(await database()).query("INSERT INTO law_image_checks VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=excluded.data",[id,JSON.stringify(data)]);return;}await mutate(s=>{s.checks[id]=data;});}
export async function saveImageReview(data:ImageReview){if(process.env.DATABASE_URL){await(await database()).query(`INSERT INTO law_image_reviews VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO UPDATE SET data=CASE WHEN law_image_reviews.data->>'manual'='true' THEN law_image_reviews.data WHEN law_image_reviews.data->>'hidden'='true' THEN excluded.data||'{"hidden":true}'::jsonb ELSE excluded.data END,case_ids=excluded.case_ids`,[data.id,data.areaId,data.caseIds,JSON.stringify(data)]);return;}await mutate(s=>{if(s.reviews[data.id]?.manual)return;s.reviews[data.id]={...data,...(s.reviews[data.id]?.hidden?{hidden:true}:{})};});}
export async function imageReviews(areaId?:string,caseIds?:string[]):Promise<ImageReview[]>{if(process.env.DATABASE_URL)return(await(await database()).query("SELECT data FROM law_image_reviews WHERE ($1::text IS NULL OR area_id=$1) AND ($2::text[] IS NULL OR case_ids && $2)",[areaId??null,caseIds??null])).rows.map(r=>r.data);return Object.values((await local()).reviews).filter(r=>(!areaId||r.areaId===areaId)&&(!caseIds||r.caseIds.some(id=>caseIds.includes(id))));}
export async function hideImage(id:string){if(process.env.DATABASE_URL){await(await database()).query(`UPDATE law_image_reviews SET data=jsonb_set(data,'{hidden}','true') WHERE id=$1`,[id]);return;}await mutate(s=>{if(s.reviews[id])s.reviews[id].hidden=true;});}
export function displayedImageReviews(rows:ImageReview[]){return rows.filter(r=>!r.hidden&&r.outcome==="accepted"&&approvedImageCheck(r.visual?.approval)&&!rows.some(h=>h.hidden&&h.areaId===r.areaId&&h.sourceUrl===r.sourceUrl&&h.caseIds.some(id=>r.caseIds.includes(id)))).sort((a,b)=>Number(Boolean(b.manual&&b.selected))-Number(Boolean(a.manual&&a.selected)) || Number(a.visual?.approval?.generated==="gis-boundary-v1")-Number(b.visual?.approval?.generated==="gis-boundary-v1") || (b.documentDate??b.visual?.approval?.sourceDate??"").localeCompare(a.documentDate??a.visual?.approval?.sourceDate??"") || imageRank(a.visual?.approval?.type??"")-imageRank(b.visual?.approval?.type??"") || b.checkedAt.localeCompare(a.checkedAt));}
export async function approvedCaseImages(areaId:string,caseIds:string[]):Promise<MapVisual[]>{const rows=displayedImageReviews(await imageReviews(areaId,caseIds));return [...new Map(caseIds.flatMap(id=>{const v=rows.find(r=>r.caseIds.includes(id))?.visual;return v?[[v.src,v] as const]:[] })).values()];}
export async function imageAssetIsActive(areaId:string,src:string){return displayedImageReviews(await imageReviews(areaId)).some(r=>r.visual?.src===src);}
export async function reserveImageCheck(id:string,data:ImageCheck):Promise<boolean>{
 if(process.env.DATABASE_URL)return Boolean((await(await database()).query("INSERT INTO law_image_checks VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE law_image_checks.data->>'type' IN ('unchecked','classification unavailable') AND (law_image_checks.data->>'checkedAt')::timestamptz <= now()-interval '24 hours' RETURNING id",[id,JSON.stringify(data)])).rowCount);
 let claimed=false;await mutate(s=>{if(!s.checks[id]||imageCheckExpired(s.checks[id])){s.checks[id]=data;claimed=true;}});return claimed;
}

export async function publishCaseImage(areaId:string,caseIds:string[],visual:MapVisual,originalSrc=visual.src){
 if(!approvedImageCheck(visual.approval))return;
 const {createHash}=await import("node:crypto");
 const id=createHash("sha256").update(areaId+caseIds.slice().sort().join(",")+originalSrc).digest("hex");
 await saveImageReview({id,areaId,caseIds,title:visual.documentTitle??visual.label,sourceUrl:visual.sourceUrl,originalSrc,outcome:"accepted",visual,checkedAt:new Date().toISOString()});
}

export function imageRank(type:string){return ["site plan","concept plan","preliminary plat","landscape plan","building elevation","rendering","vicinity/aerial exhibit","project area map"].indexOf(type)<0?99:["site plan","concept plan","preliminary plat","landscape plan","building elevation","rendering","vicinity/aerial exhibit","project area map"].indexOf(type);}
export async function selectImage(id:string){
 const rows=await imageReviews();const row=rows.find(r=>r.id===id);if(!row||!approvedImageCheck(row.visual?.approval))throw new Error("Only privacy-approved images may be selected");
 if(process.env.DATABASE_URL){const db=await database();await db.query("UPDATE law_image_reviews SET data=CASE WHEN id=$1 THEN data||'{\"manual\":true,\"selected\":true,\"hidden\":false}'::jsonb ELSE data||'{\"selected\":false}'::jsonb END WHERE area_id=$2 AND case_ids && $3",[id,row.areaId,row.caseIds]);}

 else await mutate(s=>{for(const r of Object.values(s.reviews))if(r.areaId===row.areaId&&r.caseIds.some(c=>row.caseIds.includes(c)))r.selected=false;Object.assign(s.reviews[id],{manual:true,selected:true,hidden:false});});
}
export async function unhideImage(id:string){
 const row=(await imageReviews()).find(r=>r.id===id);if(!row||!approvedImageCheck(row.visual?.approval))throw new Error("Only privacy-approved images may be unhidden");
 if(process.env.DATABASE_URL)await(await database()).query("UPDATE law_image_reviews SET data=data||'{\"hidden\":false}'::jsonb WHERE area_id=$1 AND case_ids && $2 AND data->>'sourceUrl'=$3",[row.areaId,row.caseIds,row.sourceUrl]);
 else await mutate(s=>{for(const r of Object.values(s.reviews))if(r.areaId===row.areaId&&r.sourceUrl===row.sourceUrl&&r.caseIds.some(c=>row.caseIds.includes(c)))r.hidden=false;});
}
