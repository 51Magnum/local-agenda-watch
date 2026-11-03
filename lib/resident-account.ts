import "server-only";
import {randomUUID,randomBytes} from "node:crypto";
import {alertScope,parseWatchTarget,type StoredWatchTarget} from "./alerts";
import {residentDb,type Resident} from "./resident-auth";
import {requireProductionMutation} from "./runtime-environment";
import {pinLimit,validatePlanRadius,type ResidentPlan} from "./plan-policy";
export type ResidentPin={id:string;source:"saved"|"alert";label:string;coordinates:[number,number];radiusMiles:number;archived?:boolean;alertsEnabled?:boolean};
export async function residentWatches(resident:Resident){return(await(await residentDb()).query("SELECT id,target,confirmed_at,unsubscribed_at FROM law_alert_subscriptions WHERE scope=$1 AND lower(email)=$2 AND target->>'label' IS DISTINCT FROM 'Internal correction notices' ORDER BY created_at",[alertScope(),resident.email])).rows as {id:string;target:StoredWatchTarget;confirmed_at:string|null;unsubscribed_at:string|null}[];}
export async function residentPins(resident:Resident):Promise<ResidentPin[]>{
 const rows=(await(await residentDb()).query(`SELECT p.*,s.confirmed_at,s.unsubscribed_at FROM law_resident_pins p LEFT JOIN law_alert_subscriptions s ON s.id=p.subscription_id WHERE p.scope=$1 AND p.email=$2 ORDER BY p.archived,p.created_at,p.id`,[alertScope(),resident.email])).rows;
 return rows.map(p=>({id:String(p.id),source:"saved",label:String(p.label),coordinates:[Number(p.longitude),Number(p.latitude)],radiusMiles:Number(p.radius_miles),archived:!!p.archived,alertsEnabled:!!p.confirmed_at&&!p.unsubscribed_at&&!p.archived}));
}
export async function residentPlan(resident:Resident):Promise<ResidentPlan>{
 const row=(await(await residentDb()).query("SELECT plan FROM law_resident_profiles WHERE scope=$1 AND email=$2",[alertScope(),resident.email])).rows[0];
 return row?.plan==="paid"?"paid":"free";
}
export async function saveResidentName(resident:Resident,value:unknown){
 requireProductionMutation();if(typeof value!=="string"||value.length>100||/[\u0000-\u001f\u007f]/.test(value))throw Error("Use a name of up to 100 characters.");
 await(await residentDb()).query("UPDATE law_resident_profiles SET display_name=$3 WHERE scope=$1 AND email=$2",[alertScope(),resident.email,value.trim()]);
}
export async function stopResidentWatch(resident:Resident,id:string){
 requireProductionMutation();return(await(await residentDb()).query("UPDATE law_alert_subscriptions SET unsubscribed_at=now() WHERE id=$1 AND scope=$2 AND lower(email)=$3 RETURNING id",[id,alertScope(),resident.email])).rows.length>0;
}
/** Never trust a plan or owner supplied by the browser (or a stale session). */
export async function saveResidentPin(resident:Resident,input:unknown,id?:string,source="saved",alertsEnabled?:boolean){
 requireProductionMutation();const pin=parseWatchTarget(input);if(pin.kind!=="place")throw Error("Choose a place pin.");
 if(!["saved","alert"].includes(source))throw Error("Choose a saved pin.");
 const client=await(await residentDb()).connect(),scope=alertScope();
 try{
  await client.query("BEGIN");
  const owner=(await client.query("SELECT plan FROM law_resident_profiles WHERE scope=$1 AND email=$2 FOR UPDATE",[scope,resident.email])).rows[0];
  const existing=id?(await client.query(`SELECT * FROM law_resident_pins WHERE ${source==="alert"?"subscription_id":"id"}=$1 AND scope=$2 AND email=$3`,[id,scope,resident.email])).rows[0]:undefined;
  if(id&&!existing){await client.query("ROLLBACK");return false;}
  if(!owner)throw Error("Sign in required.");
  const plan=owner.plan as ResidentPlan;validatePlanRadius(plan,pin.radiusMiles);
  if(!existing||existing.archived){
   const count=Number((await client.query("SELECT count(*) AS n FROM law_resident_pins WHERE scope=$1 AND email=$2 AND NOT archived",[scope,resident.email])).rows[0].n);
   if(count>=pinLimit(plan))throw Error("Plan pin limit reached.");
  }
  const pinId=existing?.id??randomUUID();
  if(existing)await client.query("UPDATE law_resident_pins SET label=$4,longitude=$5,latitude=$6,radius_miles=$7,archived=false WHERE id=$1 AND scope=$2 AND email=$3",[pinId,scope,resident.email,pin.label,...pin.coordinates,pin.radiusMiles]);
  else await client.query("INSERT INTO law_resident_pins(id,scope,email,label,longitude,latitude,radius_miles) VALUES($1,$2,$3,$4,$5,$6,$7)",[pinId,scope,resident.email,pin.label,...pin.coordinates,pin.radiusMiles]);
  if(alertsEnabled===false&&existing?.subscription_id)await client.query("UPDATE law_alert_subscriptions SET unsubscribed_at=coalesce(unsubscribed_at,now()) WHERE id=$1",[existing.subscription_id]);
  if(alertsEnabled===true){
   if(existing?.subscription_id)await client.query("UPDATE law_alert_subscriptions SET confirmed_at=coalesce(confirmed_at,now()),unsubscribed_at=NULL,state=NULL WHERE id=$1",[existing.subscription_id]);
   else {
    const subscriptionId=randomUUID();
    // The verified resident explicitly opts in here; saving alone never starts email.
    // Link while unconfirmed so the subscription trigger reuses this same pin.
    await client.query("INSERT INTO law_alert_subscriptions(id,scope,email,target,confirm_hash,confirm_expires,unsubscribe_token) VALUES($1,$2,$3,$4,$5,now(),$6)",[subscriptionId,scope,resident.email,JSON.stringify(pin),randomBytes(32).toString("hex"),randomBytes(32).toString("base64url")]);
    await client.query("UPDATE law_resident_pins SET subscription_id=$2 WHERE id=$1",[pinId,subscriptionId]);
    await client.query("UPDATE law_alert_subscriptions SET confirmed_at=now() WHERE id=$1",[subscriptionId]);
   }
  }
  await client.query("COMMIT");return true;
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
export async function removeResidentPin(resident:Resident,id:string,source:string){
 requireProductionMutation();if(!["saved","alert"].includes(source))throw Error("Choose a saved pin.");
 return(await(await residentDb()).query(`DELETE FROM law_resident_pins WHERE ${source==="alert"?"subscription_id":"id"}=$1 AND scope=$2 AND email=$3 RETURNING id`,[id,alertScope(),resident.email])).rows.length>0;
}
