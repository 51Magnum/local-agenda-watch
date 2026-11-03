import "server-only";
import {randomUUID} from "node:crypto";
import {alertScope,parseWatchTarget,type StoredWatchTarget} from "./alerts";
import {residentDb,type Resident} from "./resident-auth";
import {requireProductionMutation} from "./runtime-environment";
export type ResidentPin={id:string;source:"saved"|"alert";label:string;coordinates:[number,number];radiusMiles:number};
export async function residentWatches(resident:Resident){return(await(await residentDb()).query("SELECT id,target,confirmed_at,unsubscribed_at FROM law_alert_subscriptions WHERE scope=$1 AND lower(email)=$2 AND target->>'label' IS DISTINCT FROM 'Internal correction notices' ORDER BY created_at",[alertScope(),resident.email])).rows as {id:string;target:StoredWatchTarget;confirmed_at:string|null;unsubscribed_at:string|null}[];}
export async function residentPins(resident:Resident):Promise<ResidentPin[]>{
 const db=await residentDb(),pins=await db.query("SELECT id,label,longitude,latitude,radius_miles FROM law_resident_pins WHERE scope=$1 AND email=$2 ORDER BY created_at",[alertScope(),resident.email]),watches=await residentWatches(resident);
 return [...pins.rows.map(p=>({id:String(p.id),source:"saved" as const,label:String(p.label),coordinates:[Number(p.longitude),Number(p.latitude)] as [number,number],radiusMiles:Number(p.radius_miles)})),...watches.flatMap(w=>w.target.kind==="place"&&w.confirmed_at&&!w.unsubscribed_at?[{id:w.id,source:"alert" as const,...w.target}]:[])];
}
export async function saveResidentName(resident:Resident,value:unknown){
 requireProductionMutation();if(typeof value!=="string"||value.length>100||/[\u0000-\u001f\u007f]/.test(value))throw Error("Use a name of up to 100 characters.");
 await(await residentDb()).query("UPDATE law_resident_profiles SET display_name=$3 WHERE scope=$1 AND email=$2",[alertScope(),resident.email,value.trim()]);
}
export async function stopResidentWatch(resident:Resident,id:string){
 requireProductionMutation();return(await(await residentDb()).query("UPDATE law_alert_subscriptions SET unsubscribed_at=now() WHERE id=$1 AND scope=$2 AND lower(email)=$3 RETURNING id",[id,alertScope(),resident.email])).rows.length>0;
}
export async function saveResidentPin(resident:Resident,input:unknown,id?:string,source="saved"){
 requireProductionMutation();const pin=parseWatchTarget(input);if(pin.kind!=="place")throw Error("Choose a place pin.");
 const db=await residentDb();
 if(source==="alert"){
  if(!id)throw Error("Choose a saved pin.");
  return(await db.query("UPDATE law_alert_subscriptions SET target=$4,state=NULL WHERE id=$1 AND scope=$2 AND lower(email)=$3 AND target->>'kind'='place' AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL RETURNING id",[id,alertScope(),resident.email,JSON.stringify(pin)])).rows.length>0;
 }
 if(source!=="saved")throw Error("Choose a saved pin.");
 if(id)return(await db.query("UPDATE law_resident_pins SET label=$4,longitude=$5,latitude=$6,radius_miles=$7 WHERE id=$1 AND scope=$2 AND email=$3 RETURNING id",[id,alertScope(),resident.email,pin.label,...pin.coordinates,pin.radiusMiles])).rows.length>0;
 const saved=await db.query("INSERT INTO law_resident_pins(id,scope,email,label,longitude,latitude,radius_miles) SELECT $1,$2,$3,$4,$5,$6,$7 WHERE (SELECT count(*) FROM law_resident_pins WHERE scope=$2 AND email=$3)<100 RETURNING id",[randomUUID(),alertScope(),resident.email,pin.label,...pin.coordinates,pin.radiusMiles]);if(!saved.rows.length)throw Error("Saved pin limit reached");return true;
}
export async function removeResidentPin(resident:Resident,id:string,source:string){
 requireProductionMutation();
 if(source==="alert")return stopResidentWatch(resident,id);
 if(source!=="saved")throw Error("Choose a saved pin.");
 return(await(await residentDb()).query("DELETE FROM law_resident_pins WHERE id=$1 AND scope=$2 AND email=$3 RETURNING id",[id,alertScope(),resident.email])).rows.length>0;
}
