import "server-only";
import {createHash,randomBytes} from "node:crypto";
import {residentDb} from "./resident-auth";
import {alertScope} from "./alerts";
import {reviewerIdentity} from "./timeline/auth";
import {requireProductionMutation} from "./runtime-environment";
import type {ResidentPlan} from "./plan-policy";
import type {AdminResident,AdminResidentSearch,AdminResidentPin,AdminPlanChange} from "./admin-resident-types";

export class ResidentAdminError extends Error {
 constructor(public status:number,message:string){super(message);}
}
function admin(authorization:string|null){const actor=reviewerIdentity(authorization);if(!actor)throw new ResidentAdminError(401,"Admin access required.");return actor;}
export function validResidentId(id:string){return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);}
const iso=(value:Date|string)=>new Date(value).toISOString();
const profileColumns=`p.resident_id AS id,p.email,p.plan,p.created_at,p.last_sign_in_at,
 (SELECT count(*) FROM law_resident_pins WHERE scope=p.scope AND email=p.email AND NOT archived) AS active_pins,
 (SELECT count(*) FROM law_resident_pins WHERE scope=p.scope AND email=p.email AND archived) AS inactive_pins`;
function profile(row:Record<string,unknown>):AdminResident{return {id:String(row.id),email:String(row.email),plan:row.plan as ResidentPlan,createdAt:iso(row.created_at as Date),lastSignInAt:row.last_sign_in_at?iso(row.last_sign_in_at as Date):null,activePins:Number(row.active_pins),inactivePins:Number(row.inactive_pins)};}
export async function searchResidents(authorization:string|null,input:unknown,mode:unknown="partial"):Promise<AdminResidentSearch>{
 admin(authorization);
 if(typeof input!=="string"||input.length>254||/[\u0000-\u001f\u007f]/.test(input)||!['exact','partial'].includes(String(mode)))throw new ResidentAdminError(400,"Use an email or part of an email.");
 const search=input.trim().toLowerCase(),value=mode==="exact"?search:"%"+search.replace(/[\\%_]/g,"\\$&")+"%";
 const rows=(await(await residentDb()).query(`SELECT ${profileColumns} FROM law_resident_profiles p WHERE p.scope=$1 AND lower(p.email) ${mode==="exact"?"=":"LIKE"} $2 ORDER BY p.created_at DESC,p.resident_id LIMIT 51`,[alertScope(),value])).rows;
 return {residents:rows.slice(0,50).map(profile),hasMore:rows.length>50};
}
export async function adminResidentDetail(authorization:string|null,id:string){
 admin(authorization);if(!validResidentId(id))throw new ResidentAdminError(404,"Account not found.");
 const db=await residentDb(),row=(await db.query(`SELECT ${profileColumns} FROM law_resident_profiles p WHERE p.scope=$1 AND p.resident_id=$2`,[alertScope(),id])).rows[0];
 if(!row)throw new ResidentAdminError(404,"Account not found.");
 const pins=(await db.query(`SELECT p.id,p.label,p.radius_miles,p.archived,s.confirmed_at,s.unsubscribed_at FROM law_resident_pins p LEFT JOIN law_alert_subscriptions s ON s.id=p.subscription_id WHERE p.scope=$1 AND p.email=$2 ORDER BY p.archived,p.created_at,p.id`,[alertScope(),row.email])).rows.map(p=>({id:String(p.id),label:String(p.label),radiusMiles:Number(p.radius_miles),active:!p.archived,alertsEnabled:!p.archived&&!!p.confirmed_at&&!p.unsubscribed_at})) as AdminResidentPin[];
 return {resident:profile(row),pins};
}
export async function recentPlanChanges(authorization:string|null,residentId?:string):Promise<AdminPlanChange[]>{
 admin(authorization);if(residentId&&!validResidentId(residentId))throw new ResidentAdminError(404,"Account not found.");
 const rows=(await(await residentDb()).query(`SELECT c.*,p.email FROM law_resident_plan_changes c LEFT JOIN law_resident_profiles p ON p.resident_id=c.resident_id AND p.scope=c.scope WHERE c.scope=$1 ${residentId?"AND c.resident_id=$2":""} ORDER BY c.created_at DESC,c.id DESC LIMIT 30`,residentId?[alertScope(),residentId]:[alertScope()])).rows;
 return rows.map(r=>({id:String(r.id),residentId:r.resident_id?String(r.resident_id):null,email:r.email?String(r.email):null,actor:String(r.actor),action:String(r.action),oldPlan:r.old_plan as ResidentPlan,newPlan:r.new_plan as ResidentPlan,createdAt:iso(r.created_at)}));
}
/** A server-stored, short-lived intent makes the second step explicit and single-use. */
export async function prepareResidentPlanChange(authorization:string|null,id:string,newPlan:unknown){
 requireProductionMutation();const actor=admin(authorization);
 if(newPlan!=="free"&&newPlan!=="paid")throw new ResidentAdminError(400,"Choose Free or Paid.");
 const detail=await adminResidentDetail(authorization,id),oldPlan=detail.resident.plan;
 if(oldPlan===newPlan)throw new ResidentAdminError(400,"This account already has that plan.");
 const token=randomBytes(32).toString("base64url"),db=await residentDb();
 await db.query("DELETE FROM law_resident_plan_intents WHERE expires_at<=now()");
 await db.query("INSERT INTO law_resident_plan_intents(token_hash,scope,actor,resident_id,old_plan,new_plan) VALUES($1,$2,$3,$4,$5,$6)",[createHash("sha256").update(token).digest("hex"),alertScope(),actor,id,oldPlan,newPlan]);
 return {token,...detail,oldPlan,newPlan};
}
export async function commitResidentPlanChange(authorization:string|null,token:unknown){
 requireProductionMutation();const actor=admin(authorization);
 if(typeof token!=="string"||!/^[-\w]{43}$/.test(token))throw new ResidentAdminError(400,"Review the plan change first.");
 const client=await(await residentDb()).connect();
 try{
  await client.query("BEGIN");
  const intent=(await client.query("DELETE FROM law_resident_plan_intents WHERE token_hash=$1 AND scope=$2 AND actor=$3 AND expires_at>now() RETURNING *",[createHash("sha256").update(token).digest("hex"),alertScope(),actor])).rows[0];
  if(!intent)throw new ResidentAdminError(409,"Confirmation expired or was already used. Review the change again.");
  const current=(await client.query("SELECT plan FROM law_resident_profiles WHERE scope=$1 AND resident_id=$2 FOR UPDATE",[alertScope(),intent.resident_id])).rows[0];
  if(!current||current.plan!==intent.old_plan)throw new ResidentAdminError(409,"The account plan changed. Review it again before confirming.");
  // A normal UPDATE invokes the existing downgrade/pin policy triggers.
  await client.query("UPDATE law_resident_profiles SET plan=$3 WHERE scope=$1 AND resident_id=$2",[alertScope(),intent.resident_id,intent.new_plan]);
  await client.query("INSERT INTO law_resident_plan_changes(scope,resident_id,actor,action,old_plan,new_plan) VALUES($1,$2,$3,'resident.plan.change',$4,$5)",[alertScope(),intent.resident_id,actor,current.plan,intent.new_plan]);
  await client.query("COMMIT");return String(intent.resident_id);
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
