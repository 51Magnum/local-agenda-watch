import { createHash, randomBytes, randomUUID } from "node:crypto";
import { alertReadiness, alertScope, alertsDb, sendAlertMail, watchMatches, type Subscription } from "../alerts";
import { projectDetail } from "../maps/project-detail";
import type { MapCase } from "../maps/types";
import { AREAS, areaPath } from "../areas/registry";
import { booleanIntersects, circle, feature } from "@turf/turf";
import { SITE_ORIGIN } from "../site-config";
import { dedupeProjects, emailProject, isReminderDue, localDay, snapshotFingerprint, type EmailProject, type WatchState, type ProjectSnapshot } from "./project";
import { announcementTemplate, correctionTemplate, digestTemplates, type EmailLinks, type RenderedEmail } from "./templates";

const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
type States=Record<string,WatchState>;
export type Delivery={id:string;email:string;kind:string;payload:{messages:RenderedEmail[];unsubscribe:string;projects?:ProjectSnapshot[];renderedAt?:string};states:States|null;status:string;sent_parts:number;attempts:number;next_attempt:string};
export function subscriptionLinks(token:string):EmailLinks{return {mailingAddress:process.env.ALERTS_MAILING_ADDRESS!,unsubscribe:SITE_ORIGIN+"/api/alerts/unsubscribe?token="+token,manage:SITE_ORIGIN+"/api/alerts/manage?token="+token};}
async function queue(id:string,email:string,kind:string,messages:RenderedEmail[],unsubscribe:string,states:States|null,projects:EmailProject[]=[]){
 const db=await alertsDb();
 id+="/"+hash(JSON.stringify(messages)).slice(0,16);
 const result=await db.query("INSERT INTO law_alert_deliveries(id,scope,email,kind,payload,states) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING *",[id,alertScope(),email,kind,JSON.stringify({messages,unsubscribe,projects:projects.map(p=>p.snapshot),renderedAt:new Date().toISOString()}),states?JSON.stringify(states):null]);
 return (result.rows[0]??(await db.query("SELECT * FROM law_alert_deliveries WHERE id=$1",[id])).rows[0]) as Delivery;
}
/** Persist stable payload and per-part progress before retrying a recipient. */
export async function deliverQueued(row:Delivery,now=new Date()){
 now=new Date(Math.max(now.getTime(),Date.now()));
 if(row.status!=="pending"||row.attempts>0&&Date.parse(row.next_attempt)>now.getTime())return false;
 const db=await alertsDb();
 try{
  for(const snapshot of row.payload.projects??[]){
   const data=await projectDetail(snapshot.areaId,snapshot.caseId);if(!data)throw Error("Current project data unavailable");
   const current=emailProject(data,undefined,undefined,now);
   const deadline=snapshot.next?.deadline;
   const expired=(at:Date)=>!!deadline&&(deadline.length===10?deadline<localDay(at,snapshot.timezone):Date.parse(deadline)<=at.getTime());
   if(snapshotFingerprint(current.snapshot)!==snapshotFingerprint(snapshot)||(row.kind==="reminder"&&!isReminderDue(current,now))||(expired(now)&&!expired(new Date(row.payload.renderedAt??now)))){
    await db.query("UPDATE law_alert_deliveries SET status='cancelled',last_error='Public record or deadline changed; rebuild from current data' WHERE id=$1",[row.id]);row.status="cancelled";return false;
   }
  }
  if(row.kind==="correction"){
   const token=new URL(row.payload.unsubscribe).searchParams.get("token");
   if(!(await db.query("SELECT id FROM law_alert_subscriptions WHERE scope=$1 AND email=$2 AND unsubscribe_token=$3 AND unsubscribed_at IS NULL AND confirmed_at IS NOT NULL",[alertScope(),row.email,token])).rowCount){await db.query("UPDATE law_alert_deliveries SET status='cancelled' WHERE id=$1",[row.id]);return false;}
  }
  for(let i=row.sent_parts;i<row.payload.messages.length;i++){
   const message=row.payload.messages[i];
   await sendAlertMail({to:row.email,...message,key:row.id+"/"+i,unsubscribe:row.payload.unsubscribe,mode:row.kind==="correction"?"internal":"live"});
   await db.query("UPDATE law_alert_deliveries SET sent_parts=$2 WHERE id=$1",[row.id,i+1]);
  }
  const client=await db.connect();
  try{await client.query("BEGIN");
   if(row.states)for(const [id,state]of Object.entries(row.states))await client.query("UPDATE law_alert_subscriptions SET state=$2,last_sent=$3 WHERE id=$1 AND scope=$4 AND unsubscribed_at IS NULL AND confirmed_at IS NOT NULL",[id,JSON.stringify(state),localDay(now),alertScope()]);
   await client.query("UPDATE law_alert_deliveries SET status='sent',sent_at=now(),last_error=NULL WHERE id=$1",[row.id]);await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  return true;
 }catch{
  // Error bodies may contain recipient data; persist only a stable, private reason.
  const delay=Math.min(360,10*2**Math.min(row.attempts,6));
  await db.query("UPDATE law_alert_deliveries SET attempts=attempts+1,last_error='Delivery or state update failed; queued for retry',next_attempt=now()+($2::int*interval '1 minute') WHERE id=$1",[row.id,delay]);
  throw Error("Recipient delivery failed; retained for retry");
 }
}
function previousState(sub:Subscription):WatchState|undefined{return sub.state?.version===2?sub.state as WatchState:undefined;}
export async function loadWatchProjects(sub:Subscription,rows:MapCase[],load:typeof projectDetail=projectDetail,now=new Date()){
 const target=sub.target;if(target.kind==="pending")return [];
 const matches=target.kind==="project"?[{areaId:target.areaId,id:target.caseId}]:watchMatches(target,rows);
 const projects:EmailProject[]=[];
 for(const match of matches){
  if(!match.areaId)continue;
  const detail=await load(match.areaId,match.id);if(!detail)throw Error("A watched project could not be verified; keep its previous state");
  const current=emailProject(detail,undefined,target.kind==="place"?target:undefined,now),previous=previousState(sub)?.projects[current.snapshot.key];
  const item=emailProject(detail,previous,target.kind==="place"?target:undefined,now);
  if(previousState(sub)&&!previous)item.changes=["New project in your watched area: "+item.snapshot.headline+"."];
  projects.push(item);
 }
 return dedupeProjects(projects);
}
/** Failures are isolated by recipient; all of a person's watches travel together. */
export async function processRecipients<T>(recipients:T[],work:(recipient:T)=>Promise<void>,settled?:(recipient:T)=>Promise<void>){let completed=0,failed=0;for(const recipient of recipients){let error=false;try{await work(recipient);}catch{error=true;}try{await settled?.(recipient);}catch{error=true;}if(error)failed++;else completed++;}return {completed,failed};}
export async function sendScheduledAlerts(now=new Date()){
 if(!alertReadiness().ready||!alertReadiness().deliveryEnabled)return {sent:0,checked:0,skipped:"Live delivery is paused pending approval or mail configuration"};
 const db=await alertsDb(),day=localDay(now),scope=alertScope();
 // LIMIT applies to people, never subscription rows. Fetch ALL watches below.
 const recipients=(await db.query(`SELECT r.email FROM (SELECT DISTINCT lower(email) AS email FROM law_alert_subscriptions WHERE scope=$1 AND confirmed_at IS NOT NULL AND target->>'kind'<>'pending' AND unsubscribed_at IS NULL) r LEFT JOIN law_alert_recipient_checks c ON c.scope=$1 AND c.email=r.email WHERE NOT EXISTS(SELECT 1 FROM law_alert_deliveries d WHERE d.scope=$1 AND d.email=r.email AND d.kind='digest' AND d.status='pending' AND d.next_attempt>now()) ORDER BY c.last_checked NULLS FIRST,r.email LIMIT 250`,[scope])).rows as {email:string}[];
 const rows=(await db.query(`SELECT area_id AS "areaId",data-'visual'-'popup' AS data FROM law_map_cases WHERE area_id=ANY($1::text[])`,[Object.values(AREAS).filter(a=>a.status==="live").map(a=>a.id)])).rows.map(r=>({...r.data,areaId:r.areaId})) as MapCase[];
 const cache=new Map<string,ReturnType<typeof projectDetail>>();
 const load:typeof projectDetail=(area,id)=>{const key=area+":"+id;if(!cache.has(key))cache.set(key,projectDetail(area,id));return cache.get(key)!;};
 let sent=0;
 const report=await processRecipients(recipients,async({email})=>{
  const subs=(await db.query(`SELECT id,email,target,state,unsubscribe_token,last_sent FROM law_alert_subscriptions WHERE scope=$1 AND lower(email)=$2 AND confirmed_at IS NOT NULL AND target->>'kind'<>'pending' AND unsubscribed_at IS NULL ORDER BY id`,[scope,email])).rows as (Subscription&{last_sent:string|Date|null})[];
  if(!subs.length)return;
  const alreadyToday=subs.every(s=>s.last_sent&&(s.last_sent instanceof Date?localDay(s.last_sent):s.last_sent.slice(0,10))===day);
  // Retry a stable queued message before advancing this person's snapshots.
  const pending=(await db.query("SELECT * FROM law_alert_deliveries WHERE scope=$1 AND email=$2 AND kind='digest' AND status='pending' ORDER BY created_at LIMIT 1",[scope,email])).rows[0] as Delivery|undefined;
  if(pending){
   if(Object.keys(pending.states??{}).every(id=>subs.some(s=>s.id===id))){if(await deliverQueued(pending,now))sent+=pending.payload.messages.length;else if(pending.status!=="cancelled")return;}
   else await db.query("UPDATE law_alert_deliveries SET status='cancelled' WHERE id=$1",[pending.id]);
  }
  const all:EmailProject[]=[],changed:EmailProject[]=[],states:States={};
  for(const sub of subs){const projects=await loadWatchProjects(sub,rows,load,now);all.push(...projects);changed.push(...projects.filter(p=>p.changes.length));states[sub.id]={version:2,projects:Object.fromEntries(projects.map(p=>[p.snapshot.key,p.snapshot]))};}
  const unique=dedupeProjects(changed),links=subscriptionLinks(subs[0].unsubscribe_token),labels=[...new Set(subs.flatMap(s=>s.target.kind==="place"?[s.target.label]:[]))],label=labels.length===1?labels[0]:undefined;
  if(unique.length&&!alreadyToday){
   const queued=await queue("digest/"+hash(scope+email+day),email,"digest",digestTemplates(unique,links,label,false,now),links.unsubscribe,states,unique);
   if(await deliverQueued(queued,now))sent+=queued.payload.messages.length;
  }else if(!alreadyToday){
   // First-run or legacy hashes establish a structured baseline, without claiming a change.
   for(const [id,state]of Object.entries(states))await db.query("UPDATE law_alert_subscriptions SET state=$2,last_sent=$3 WHERE id=$1 AND scope=$4 AND unsubscribed_at IS NULL",[id,JSON.stringify(state),day,scope]);
  }
  for(const project of dedupeProjects(all).filter(p=>isReminderDue(p,now))){
   const queued=await queue("reminder/"+hash(scope+email+project.snapshot.key+project.snapshot.next!.startsAt),email,"reminder",digestTemplates([{...project,changes:["A verified hearing for this watched project is two calendar days away."]}],links,label,true,now),links.unsubscribe,null,[project]);
   if(await deliverQueued(queued,now))sent++;
  }
  await db.query("UPDATE law_alert_deliveries SET status='cancelled',last_error='Reminder window elapsed' WHERE scope=$1 AND email=$2 AND kind='reminder' AND status='pending' AND (created_at AT TIME ZONE 'America/Denver')::date<$3::date",[scope,email,day]);
 },async({email})=>{await db.query("INSERT INTO law_alert_recipient_checks(scope,email,last_checked) VALUES($1,$2,now()) ON CONFLICT(scope,email) DO UPDATE SET last_checked=now()",[scope,email]);});
 const internals=(await db.query("SELECT * FROM law_alert_deliveries WHERE scope=$1 AND kind='correction' AND status='pending' AND next_attempt<=now() ORDER BY created_at LIMIT 100",[scope])).rows as Delivery[];
 const internalReport=await processRecipients(internals,async row=>{if(await deliverQueued(row,now))sent++;});
 return {sent,checked:recipients.length,failures:report.failed+internalReport.failed};
}
export async function sendCoverageAnnouncement(areaId:string,now=new Date()){
 if(!alertReadiness().deliveryEnabled||!alertReadiness().ready||process.env.ALERTS_ANNOUNCEMENTS_ENABLED!=="true")throw Error("Announcements require separate owner approval and mail configuration");
 const area=AREAS[areaId];if(!area||area.status!=="live")throw Error("Choose a live area");
 const db=await alertsDb(),subs=(await db.query("SELECT id,email,target,state,unsubscribe_token FROM law_alert_subscriptions WHERE scope=$1 AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL AND coverage_announcements=true AND target->>'kind'='place'",[alertScope()])).rows as Subscription[];
 const recipients=new Map<string,Subscription>();
 for(const sub of subs)if(sub.target.kind==="place"&&booleanIntersects(circle(sub.target.coordinates,sub.target.radiusMiles,{units:"miles"}),feature(area.boundary)))recipients.set(sub.email,sub);
 return processRecipients([...recipients.values()],async sub=>{const links=subscriptionLinks(sub.unsubscribe_token),message=announcementTemplate({name:area.name,url:SITE_ORIGIN+areaPath(area)},links);await deliverQueued(await queue("announcement/"+hash(alertScope()+sub.email+areaId+localDay(now)),sub.email,"announcement",[message],links.unsubscribe,null),now);});
}
export async function queueCorrectionReceived(report:{id:string;project:string;message:string;email:string|null}){
 // Preview forms never create a live-mail queue or disclose a report to an inbox.
 if(!alertReadiness().deliveryEnabled||!alertReadiness().ready)return;
 const [area,id]=report.project.split(/[/:]/);let data:Awaited<ReturnType<typeof projectDetail>>=null;
 if(area&&id&&AREAS[area])try{data=await projectDetail(area,id);}catch{/* The report can be reviewed even when its public project loader is unavailable. */}
 const db=await alertsDb(),target=JSON.stringify({kind:"pending",label:"Internal correction notices"});
 await db.query("INSERT INTO law_alert_subscriptions(id,scope,email,target,confirm_hash,confirm_expires,unsubscribe_token,confirmed_at) VALUES($1,$2,$3,$4,$5,now()+interval '10 years',$6,now()) ON CONFLICT(scope,email,target) DO NOTHING",[randomUUID(),alertScope(),"corrections@localagendawatch.com",target,hash(randomBytes(32).toString("hex")),randomBytes(32).toString("base64url")]);
 const internal=(await db.query("SELECT unsubscribe_token,unsubscribed_at FROM law_alert_subscriptions WHERE scope=$1 AND email=$2 AND target=$3::jsonb",[alertScope(),"corrections@localagendawatch.com",target])).rows[0];
 if(internal.unsubscribed_at)return;
 const links:EmailLinks=subscriptionLinks(internal.unsubscribe_token);
 const message=correctionTemplate({id:report.id,message:report.message,replyEmail:report.email??undefined,project:data?emailProject(data):undefined,projectReference:report.project},links);
 await queue("correction/"+report.id,"corrections@localagendawatch.com","correction",[message],links.unsubscribe,null);
}
