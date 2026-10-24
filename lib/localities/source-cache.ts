import { Pool } from "pg";
import {mkdir,readFile,writeFile,rename} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import path from "node:path";
import type {HearingFeed} from "./types";
let pool:Pool|undefined,initialized:Promise<unknown>|undefined;
function database(){pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000});initialized??=pool.query("CREATE TABLE IF NOT EXISTS law_source_cache (area text PRIMARY KEY, snapshot jsonb NOT NULL)").catch(e=>{initialized=undefined;throw e;});return pool;}
function file(area:string){if(!/^[a-z0-9-]+$/.test(area))throw new Error("Invalid source cache area");return path.join(process.cwd(),".data",area+"-feed.json");}
export async function readSourceFeed(area:string):Promise<HearingFeed|undefined>{
 if(process.env.DATABASE_URL){const db=database();await initialized;return(await db.query("SELECT snapshot FROM law_source_cache WHERE area=$1",[area])).rows[0]?.snapshot;}
 if(process.env.VERCEL)return;
 try{return JSON.parse(await readFile(file(area),"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
}
export async function saveSourceFeed(area:string,feed:HearingFeed){
 if(process.env.DATABASE_URL){const db=database();await initialized;await db.query("INSERT INTO law_source_cache (area,snapshot) VALUES ($1,$2::jsonb) ON CONFLICT (area) DO UPDATE SET snapshot=excluded.snapshot",[area,JSON.stringify(feed)]);return;}
 if(process.env.VERCEL)return;
 await mkdir(path.dirname(file(area)),{recursive:true});const temp=file(area)+"."+randomUUID()+".tmp";await writeFile(temp,JSON.stringify(feed));await rename(temp,file(area));
}
