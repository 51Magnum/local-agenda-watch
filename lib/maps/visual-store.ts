import { approvedImageCheck } from "./image-policy";
import {trackedRows} from "@/lib/db-transfer";
import { Pool } from "pg";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
export type VisualAsset = { preview?:import("./preview-crop").VisualPreview; image: string; page?: number; approval?: import("./image-policy").ImageCheck };
let pool: Pool | undefined, initialized: Promise<unknown> | undefined;
async function database() {
  pool ??= new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});
  initialized ??= pool.query("CREATE TABLE IF NOT EXISTS law_map_visuals (id text PRIMARY KEY, jurisdiction text NOT NULL, asset jsonb NOT NULL)").catch(e=>{initialized=undefined;throw e;});
  await initialized; return pool;
}
function filename(jurisdiction:string,id:string) {
  if(!/^[a-z0-9-]+$/.test(jurisdiction)||! /^[a-f0-9]{64}$/.test(id))throw new Error("Invalid visual asset ID");
  return path.join(process.cwd(),".data","map-visuals",jurisdiction,id+".json");
}
export async function readVisualAsset(jurisdiction:string,id:string):Promise<VisualAsset|undefined>{
  const file=filename(jurisdiction,id);
  if(process.env.DATABASE_URL)return trackedRows("visuals",(await(await database()).query("SELECT asset FROM law_map_visuals WHERE id=$1 AND jurisdiction=$2",[id,jurisdiction])).rows)[0]?.asset;
  if(process.env.VERCEL)throw new Error("Visual storage requires DATABASE_URL");
  try{return JSON.parse(await readFile(file,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
}
export async function saveVisualAsset(jurisdiction:string,id:string,asset:VisualAsset){
  const file=filename(jurisdiction,id);
  if(process.env.DATABASE_URL){await(await database()).query("INSERT INTO law_map_visuals(id,jurisdiction,asset) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO UPDATE SET asset=excluded.asset",[id,jurisdiction,JSON.stringify(asset)]);return;}
  if(process.env.VERCEL)throw new Error("Visual storage requires DATABASE_URL");
  await mkdir(path.dirname(file),{recursive:true});const temp=file+"."+randomUUID()+".tmp";await writeFile(temp,JSON.stringify(asset));await rename(temp,file);
}

export async function purgeUnverifiedVisualAssets(){
 if(process.env.DATABASE_URL){return (await(await database()).query("DELETE FROM law_map_visuals WHERE asset->'approval'->>'version' IS DISTINCT FROM 'privacy-allowlist-v1'")).rowCount??0;}
 const {readdir,unlink}=await import("node:fs/promises");let removed=0;
 const root=path.resolve(process.cwd(),".data","map-visuals");
 for(const area of await readdir(root).catch(()=>[])){if(!/^[a-z0-9-]+$/.test(area))continue;for(const name of await readdir(path.join(root,area))){if(!/^[a-f0-9]{64}\.json$/.test(name))continue;const target=path.resolve(root,area,name);if(!target.startsWith(root+path.sep))throw new Error("Invalid asset path");const asset=JSON.parse(await readFile(target,"utf8"));if(!approvedImageCheck(asset.approval)){await unlink(target);removed++;}}}return removed;
}
