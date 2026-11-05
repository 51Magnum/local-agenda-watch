import {ensureOnboardingSchema} from "./migrations";
import {randomUUID} from "node:crypto";
import {requireOnboardingMutation} from "../runtime-environment";
import {jurisdictionDb} from "./store";
import type {AgendaProgress} from "./agenda-progress";
/** This table is private collection work, never a source for staging or publication. */
export async function claimCollectionProgress(areaId:string){
 requireOnboardingMutation();await ensureOnboardingSchema();const db=await jurisdictionDb(),token=randomUUID();
 const result=await db.query("INSERT INTO law_jurisdiction_collection_progress(area_id,data,lease_token,lease_until) VALUES($1,'{}'::jsonb,$2,now()+interval '5 minutes') ON CONFLICT(area_id) DO UPDATE SET lease_token=excluded.lease_token,lease_until=excluded.lease_until WHERE law_jurisdiction_collection_progress.lease_until IS NULL OR law_jurisdiction_collection_progress.lease_until<now() RETURNING data",[areaId,token]);
 if(!result.rows.length)throw Error("Collection is already in progress; retry after its lease expires");
 return {previous:result.rows[0].data as AgendaProgress,
  save:async(data:AgendaProgress)=>{requireOnboardingMutation();const r=await db.query("UPDATE law_jurisdiction_collection_progress SET data=$3::jsonb,updated_at=now(),lease_until=now()+interval '5 minutes' WHERE area_id=$1 AND lease_token=$2",[areaId,token,JSON.stringify(data)]);if(r.rowCount!==1)throw Error("Collection progress lease was lost");},
  clear:async()=>{requireOnboardingMutation();await db.query("DELETE FROM law_jurisdiction_collection_progress WHERE area_id=$1 AND lease_token=$2",[areaId,token]);},
  release:async()=>{requireOnboardingMutation();await db.query("UPDATE law_jurisdiction_collection_progress SET lease_token=NULL,lease_until=NULL WHERE area_id=$1 AND lease_token=$2",[areaId,token]);}
 };
}
