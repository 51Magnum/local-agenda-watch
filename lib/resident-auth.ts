import "server-only";
import {createHash,randomBytes} from "node:crypto";
import type {ResidentPlan} from "./plan-policy";
import {alertsDb,alertScope,alertReadiness,sendAlertMail} from "./alerts";
import {isPreview,requireProductionMutation} from "./runtime-environment";
import {SITE_ORIGIN} from "./site-config";
import {escapeHtml} from "./email/templates";

export const SESSION_COOKIE="__Host-law_session";
export const SESSION_SECONDS=30*24*60*60;
export const GENERIC_SIGN_IN_MESSAGE="If the address is valid and requests are within the limit, a sign-in link will arrive shortly. Check your email.";
const validToken=(value:string)=>/^[A-Za-z0-9_-]{43}$/.test(value);
export const authHash=(value:string)=>createHash("sha256").update(value).digest("hex");
export function normalizeResidentEmail(value:unknown){if(typeof value!=="string")return;const email=value.trim().toLowerCase();return email.length<=254&&/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email)?email:undefined;}
export function safeReturnTo(value:unknown){
 if(typeof value!=="string"||value.length>1600||!value.startsWith("/")||/[\\\u0000-\u0020]/.test(value))return "/profile";
 try{const url=new URL(value,SITE_ORIGIN);if(url.origin===SITE_ORIGIN){if(url.pathname==="/"&&url.searchParams.get("savedPins")==="1")return "/?savedPins=1";if(["/profile","/pins"].includes(url.pathname))return url.pathname+url.search;}}catch{}
 return "/profile";
}
/** Reuses the alert pool and normalized email identity. Schema applies idempotently on first use. */
export async function residentDb(){
 return alertsDb();
}
export function signInAvailable(){return !isPreview()&&process.env.VERCEL_ENV==="production"&&alertReadiness().ready;}
export function signInEmail(url:string){
 const e=escapeHtml;
 return {subject:"Your Local Agenda Watch sign-in link",text:`Sign in to Local Agenda Watch\n\n${url}\n\nThis one-time link expires in 15 minutes. Signing in lasts 30 days on this browser. If you did not request it, ignore this email. Signing in does not subscribe you to alerts.`,html:`<!doctype html><html lang="en"><meta charset="utf-8"><body style="font:16px/1.6 Arial,sans-serif;color:#20383b;max-width:600px;margin:32px auto;padding:20px"><h1>Sign in to Local Agenda Watch</h1><p><a href="${e(url)}" style="display:inline-block;padding:14px 22px;background:#007c78;color:white;border-radius:8px">Sign in</a></p><p>This one-time link expires in <strong>15 minutes</strong>. You will stay signed in for 30 days on this browser.</p><p>If you did not request this link, ignore this email. Signing in does not subscribe you to alerts.</p><p>Local Agenda Watch<br>${e(process.env.ALERTS_MAILING_ADDRESS??"")}</p></body></html>`};
}
export async function requestSignIn(emailInput:unknown,ip:string,returnTo:unknown,now=new Date()){
 requireProductionMutation();
 const db=await residentDb(),email=normalizeResidentEmail(emailInput),scope=alertScope();
 // IP requests are counted even for malformed input. No plaintext email/IP in limit keys.
 const window=new Date(Math.floor(now.getTime()/900000)*900000).toISOString();
 for(const [key,limit]of [["auth:ip:"+authHash(scope+":"+ip),10],...email?[["auth:email:"+authHash(scope+":"+email),3] as const]:[]] as const){
  const row=await db.query("INSERT INTO law_alert_limits(key,window_start,hits) VALUES($1,$2,1) ON CONFLICT(key,window_start) DO UPDATE SET hits=law_alert_limits.hits+1 WHERE law_alert_limits.hits<$3 RETURNING hits",[key,window,limit]);if(!row.rows.length)return;
 }
 if(!email)return;
 await db.query("DELETE FROM law_alert_limits WHERE key LIKE 'auth:%' AND window_start<$1",[new Date(now.getTime()-2*86400000)]);
 await db.query("DELETE FROM law_resident_sessions WHERE expires_at<=$1",[now]);
 const token=randomBytes(32).toString("base64url"),digest=authHash(token);
 await db.query("DELETE FROM law_resident_login_links WHERE expires_at<=$1",[now]);
 await db.query("INSERT INTO law_resident_login_links(token_hash,scope,email,expires_at,return_to) VALUES($1,$2,$3,$4,$5)",[digest,scope,email,new Date(now.getTime()+15*60000),safeReturnTo(returnTo)]);
 // The fragment keeps the credential out of HTTP access logs and referrers. GET scanners do not consume it.
 const url=SITE_ORIGIN+"/auth/verify#token="+token;
 try{await sendAlertMail({to:email,...signInEmail(url),key:"signin/"+digest,unsubscribe:"",mode:"signin"});}
 catch(e){await db.query("DELETE FROM law_resident_login_links WHERE token_hash=$1",[digest]);throw e;}
}
export async function consumeSignIn(token:string,oldSession?:string,now=new Date()){
 requireProductionMutation();if(!validToken(token))return null;
 const db=await residentDb(),session=randomBytes(32).toString("base64url"),expires=new Date(now.getTime()+SESSION_SECONDS*1000);
 // Token deletion, verified identity and session creation are one atomic operation. Racing clicks cannot both win.
 const row=await db.query(`WITH link AS (
 DELETE FROM law_resident_login_links WHERE token_hash=$1 AND scope=$2 AND expires_at>$3 RETURNING email,return_to
 ), profile AS (
 INSERT INTO law_resident_profiles(scope,email,email_verified_at,last_sign_in_at) SELECT $2,email,$3,$3 FROM link
 ON CONFLICT(scope,email) DO UPDATE SET email_verified_at=excluded.email_verified_at,last_sign_in_at=excluded.last_sign_in_at RETURNING email
 ), session AS (
 INSERT INTO law_resident_sessions(token_hash,scope,email,expires_at) SELECT $4,$2,email,$5 FROM profile RETURNING email
 ), old_session AS (
 DELETE FROM law_resident_sessions WHERE token_hash=$6 AND scope=$2 AND EXISTS(SELECT 1 FROM session)
 ) SELECT session.email,link.return_to FROM session JOIN link USING(email)`,[authHash(token),alertScope(),now,authHash(session),expires,oldSession&&validToken(oldSession)?authHash(oldSession):""]);
 if(!row.rows[0])return null;
 return {token:session,expires,email:String(row.rows[0].email),returnTo:safeReturnTo(row.rows[0].return_to)};
}
export type Resident={email:string;displayName:string;plan?:ResidentPlan};
export async function residentForSession(token?:string,now=new Date()):Promise<Resident|null>{
 if(process.env.VERCEL_ENV!=="production"||!token||!validToken(token))return null;
 const db=await residentDb(),row=await db.query("SELECT p.email,p.display_name,p.plan FROM law_resident_sessions s JOIN law_resident_profiles p USING(scope,email) WHERE s.token_hash=$1 AND s.scope=$2 AND s.expires_at>$3",[authHash(token),alertScope(),now]);
 return row.rows[0]?{email:String(row.rows[0].email),displayName:String(row.rows[0].display_name),plan:row.rows[0].plan as ResidentPlan}:null;
}
export async function revokeResidentSession(token?:string){requireProductionMutation();if(token&&validToken(token))await(await residentDb()).query("DELETE FROM law_resident_sessions WHERE token_hash=$1 AND scope=$2",[authHash(token),alertScope()]);}
