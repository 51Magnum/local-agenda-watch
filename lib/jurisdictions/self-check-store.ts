import {randomUUID} from "node:crypto";
import {databaseUrl,requireOnboardingMutation} from "../runtime-environment";
import {jurisdictionDb,jurisdictionTransaction,type StagingSnapshot,type QaReport} from "./store";
import {snapshotHash} from "./snapshot-hash";
import type {ExceptionDecision,SelfCheckReport} from "./self-check";
import {redactSelfCheck} from "./self-check";
export function publicationSnapshot(snapshot:StagingSnapshot,report:SelfCheckReport,previous?:StagingSnapshot){
 const oldIds=new Set(previous?.applications.map(a=>a.recordId)??[]),permitted=new Map(report.records.filter(r=>r.publish&&(report.goLive||oldIds.has(r.recordId))).map(r=>[r.recordId,r]));
 const applications=snapshot.applications.filter(a=>permitted.has(a.recordId)).map(a=>{const r=permitted.get(a.recordId)!;return {...a,selfCheckTitle:r.title,aiTitle:!!r.proposal?.title&&r.title===r.proposal.title,hiddenDocuments:!!r.proposal?.hideDocuments};});
 const cases=new Set(applications.flatMap(a=>[a.recordId,...a.relatedCaseNumbers]));
 const meetings=snapshot.meetings.filter(m=>!m.tentative).map(m=>({...m,attachments:[],items:m.items.filter(i=>i.caseNumbers.some(id=>cases.has(id))).map(i=>{
  const own=applications.filter(a=>[a.recordId,...a.relatedCaseNumbers].some(id=>i.caseNumbers.includes(id))),sharedFailure=i.caseNumbers.some(id=>!cases.has(id));
  return {...i,title:own.map(a=>a.selfCheckTitle).join(" / "),caseNumbers:i.caseNumbers.filter(id=>cases.has(id)),matchedApplications:i.matchedApplications?.filter(a=>permitted.has(a.recordId)),attachments:own.some(a=>a.residentialPrivacy||a.hiddenDocuments)?[]:sharedFailure?i.attachments.filter(a=>a.caseNumbers?.every(id=>cases.has(id))):i.attachments};
 })})).filter(m=>m.items.length);
 return {...snapshot,selfCheck:report,applications,meetings,visuals:undefined,aiSamples:snapshot.aiSamples?.filter(s=>cases.has(s.caseId))};
}
export async function exceptionDecisions(areaId:string):Promise<ExceptionDecision[]>{
 if(!databaseUrl())return [];
 return (await(await jurisdictionDb()).query("SELECT area_id,record_id,source_hash,action,reviewer,proposal FROM law_jurisdiction_exception_decisions WHERE area_id=$1",[areaId])).rows.map(r=>({areaId:r.area_id,recordId:r.record_id,sourceHash:r.source_hash,action:r.action,reviewer:r.reviewer,proposal:r.proposal}));
}
export async function exceptionQueue(){
 if(!databaseUrl())return [];
 const r=await(await jurisdictionDb()).query("SELECT e.area_id,e.record_id,e.source_hash,e.data FROM law_jurisdiction_exceptions e LEFT JOIN law_jurisdiction_exception_decisions d USING(area_id,record_id,source_hash) WHERE d.action IS NULL ORDER BY e.area_id,e.record_id");
 return r.rows as {area_id:string;record_id:string;source_hash:string;data:SelfCheckReport["queue"]}[];
}
export async function publicationAlerts(){
 if(!databaseUrl())return [];
 const r=await(await jurisdictionDb()).query("SELECT area_id,status,data->'selfCheck' AS report FROM law_jurisdiction_publications WHERE data->'selfCheck'->>'goLive'='false' OR status='paused' ORDER BY area_id");
 return r.rows as {area_id:string;status:string;report:SelfCheckReport}[];
}
export async function decideException(input:ExceptionDecision){
 requireOnboardingMutation();if(!input.reviewer.trim()||!["approve","fix","hide"].includes(input.action))throw Error("Authenticated review decision required");
 const db=await jurisdictionDb();const entry=await db.query("SELECT data FROM law_jurisdiction_exceptions WHERE area_id=$1 AND record_id=$2 AND source_hash=$3",[input.areaId,input.recordId,input.sourceHash]);
 if(!entry.rowCount)throw Error("Exception changed; refresh the queue");
 const proposal=(entry.rows[0].data as SelfCheckReport["queue"]).find(q=>q.proposal)?.proposal;
 if(input.action==="fix"&&!proposal)throw Error("No source-verified proposal is available");
 await db.query("INSERT INTO law_jurisdiction_exception_decisions(area_id,record_id,source_hash,action,reviewer,proposal) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(area_id,record_id,source_hash) DO UPDATE SET action=excluded.action,reviewer=excluded.reviewer,proposal=excluded.proposal,decided_at=now()",[input.areaId,input.recordId,input.sourceHash,input.action,input.reviewer,proposal?JSON.stringify(proposal):null]);
}
export async function persistSelfCheck(snapshot:StagingSnapshot,report:SelfCheckReport){
 requireOnboardingMutation();if(report.snapshotHash!==snapshotHash(snapshot))throw Error("Self-check report does not match snapshot");
 await jurisdictionTransaction(async tx=>{
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))",["self-check:"+snapshot.areaId]);
  const current=await tx.query("SELECT data FROM law_jurisdiction_snapshots WHERE area_id=$1 FOR UPDATE",[snapshot.areaId]);
  if(!current.rows[0]||snapshotHash(current.rows[0].data)!==report.snapshotHash)throw Error("Staging changed during self-check; retry");
  const previous=(await tx.query("SELECT status,data FROM law_jurisdiction_publications WHERE area_id=$1 FOR UPDATE",[snapshot.areaId])).rows[0];
  await tx.query("DELETE FROM law_jurisdiction_exceptions WHERE area_id=$1",[snapshot.areaId]);
  for(const record of report.records){const entries=report.queue.filter(q=>q.recordId===record.recordId);if(entries.length)await tx.query("INSERT INTO law_jurisdiction_exceptions(area_id,record_id,source_hash,data) VALUES($1,$2,$3,$4)",[snapshot.areaId,record.recordId,record.sourceHash,JSON.stringify(entries)]);}
  const id=randomUUID();
  const qa:QaReport={id,areaId:snapshot.areaId,createdAt:report.createdAt,snapshotHash:report.snapshotHash,passed:report.goLive,checks:report.coverage.map(c=>({name:c.check,passed:c.status==="pass",detail:c.reason})),data:{selfCheck:redactSelfCheck(report)}};
  await tx.query("INSERT INTO law_jurisdiction_qa(id,area_id,data,passed) VALUES($1,$2,$3,$4)",[id,snapshot.areaId,JSON.stringify(qa),report.goLive]);
  let approval:string|null=null;
  if(report.goLive){approval=randomUUID();await tx.query("INSERT INTO law_jurisdiction_approvals(id,area_id,qa_id,admin_user) VALUES($1,$2,$3,'self-check')",[approval,snapshot.areaId,id]);}
  const published=publicationSnapshot(snapshot,report,previous?.data);
  const status=previous?.status==="paused"?"paused":report.goLive?"public":previous?.status==="public"?"public":"review";
  await tx.query("INSERT INTO law_jurisdiction_publications(area_id,status,approval_id,snapshot_hash,actor,data) VALUES($1,$2,$3,$4,'self-check',$5) ON CONFLICT(area_id) DO UPDATE SET status=excluded.status,approval_id=coalesce(excluded.approval_id,law_jurisdiction_publications.approval_id),snapshot_hash=excluded.snapshot_hash,actor='self-check',data=excluded.data,updated_at=now()",[snapshot.areaId,status,approval,report.snapshotHash,JSON.stringify(published)]);
 });
}
export async function readPublished(areaId:string):Promise<StagingSnapshot|undefined>{
 if(!databaseUrl())return;
 const r=await(await jurisdictionDb()).query("SELECT p.data FROM law_jurisdiction_publications p JOIN law_jurisdiction_approvals a ON a.id=p.approval_id AND a.area_id=p.area_id JOIN law_jurisdiction_qa q ON q.id=a.qa_id AND q.area_id=p.area_id AND q.passed=true WHERE p.area_id=$1 AND p.status='public'",[areaId]);
 return r.rows[0]?.data;
}
export async function pauseJurisdiction(areaId:string,reviewer:string){
 requireOnboardingMutation();if(!reviewer.trim())throw Error("Authenticated reviewer required");
 await(await jurisdictionDb()).query("UPDATE law_jurisdiction_publications SET status='paused',actor=$2,updated_at=now() WHERE area_id=$1",[areaId,reviewer]);
}
