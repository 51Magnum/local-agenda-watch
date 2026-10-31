import {databaseUrl} from "./runtime-environment";
import {requireProductionMutation} from "./runtime-environment";
import {Pool} from "./database-pool";
import {unstable_cache} from "next/cache";
import {PRIVACY_TAG,residentialCase,type PrivacyOverrides} from "./residential-privacy";
let pool:Pool,ready:Promise<unknown>|undefined;
async function db(){pool??=new Pool({connectionString:databaseUrl(),max:1,connectionTimeoutMillis:10000});ready??=pool.query("CREATE TABLE IF NOT EXISTS law_residential_privacy(area_id text NOT NULL,case_id text NOT NULL,mode text NOT NULL,reason text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(area_id,case_id))").catch(e=>{ready=undefined;throw e;});await ready;return pool;}
const cachedOverrides=unstable_cache(async():Promise<PrivacyOverrides>=>{
 if(!databaseUrl())return {};
 const rows=(await(await db()).query("SELECT area_id,case_id,mode,reason FROM law_residential_privacy")).rows;
 const automatic:PrivacyOverrides={};
 try{
  const candidates=(await(await db()).query("SELECT area_id,case_id,data->>'title' AS title,data->>'summary' AS summary,data->>'typeLabel' AS type,data->'residentialPrivacy' AS sensitive FROM law_map_cases WHERE data->>'residentialPrivacy'='true' OR concat_ws(' ',data->>'title',data->>'summary',data->>'typeLabel') ~* 'home[ -]*(occupation|day[ -]*care)|in[ -]*home|single[ -]*family|existing (home|residence)'")).rows;
  for(const r of candidates)if(residentialCase(r.area_id,r.case_id,{...r,residentialPrivacy:r.sensitive}))automatic[r.area_id+"/"+r.case_id]={mode:"protect",reason:"Automatic residential classification"};
 }catch(error){if((error as {code?:string}).code!=="42P01")throw error;}
 return {...automatic,...Object.fromEntries(rows.map(r=>[r.area_id+"/"+r.case_id,{mode:r.mode,reason:r.reason}]))};
},[PRIVACY_TAG],{revalidate:300,tags:[PRIVACY_TAG]});
export async function setPrivacyOverride(area:string,id:string,mode:string,reason:string){
 requireProductionMutation();
 if(!databaseUrl())throw Error("Privacy storage not configured");
 const database=await db();if(mode==="auto")await database.query("DELETE FROM law_residential_privacy WHERE area_id=$1 AND case_id=$2",[area,id]);
 else await database.query("INSERT INTO law_residential_privacy VALUES($1,$2,$3,$4,now()) ON CONFLICT(area_id,case_id) DO UPDATE SET mode=$3,reason=$4,updated_at=now()",[area,id,mode,reason]);
}

export async function privacyOverrides():Promise<PrivacyOverrides>{if(!databaseUrl())return {};return cachedOverrides();}
