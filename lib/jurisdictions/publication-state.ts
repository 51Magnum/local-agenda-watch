import {databaseUrl,requireOnboardingMutation} from "../runtime-environment";
import {jurisdictionDb,jurisdictionTransaction,type StagingSnapshot,type QaReport} from "./store";
import {snapshotHash} from "./snapshot-hash";
import {jurisdiction} from "./registry";
import {readReviewSnapshot,snapshotDrift} from "./review-snapshot";
import type {SelfCheckReport} from "./self-check";

type Row={status:"review"|"public"|"paused";snapshot_hash:string;data:StagingSnapshot;approval_id:string|null;qa:QaReport|null;qa_passed:boolean|null;staging:StagingSnapshot|null};
const query="SELECT p.status,p.snapshot_hash,p.data,a.id AS approval_id,q.data AS qa,q.passed AS qa_passed,s.data AS staging FROM law_jurisdiction_publications p LEFT JOIN law_jurisdiction_approvals a ON a.id=p.approval_id AND a.area_id=p.area_id LEFT JOIN law_jurisdiction_qa q ON q.id=a.qa_id AND q.area_id=p.area_id LEFT JOIN law_jurisdiction_snapshots s ON s.area_id=p.area_id WHERE p.area_id=$1";
function resumeBlocker(areaId:string,row:Row){
 const report=row.qa?.data.selfCheck as SelfCheckReport|undefined;
 if(!row.approval_id||!row.qa_passed||!report?.goLive||!row.data.selfCheck?.goLive)return "The current publication needs a passing self-check and its recorded approval.";
 if(!row.staging?.complete||!row.data.boundary||!row.data.applications.length)return "Complete staging, a verified boundary and eligible records are required.";
 const hash=snapshotHash(row.staging);
 if(hash!==row.snapshot_hash||hash!==row.qa?.snapshotHash)return "Staging changed after approval. Run the normal refresh and self-check again.";
 const drift=snapshotDrift(readReviewSnapshot(areaId),report);if(!drift.pass)return drift.reason;
}
/** Private operational metadata only; no record prose, credentials or personal details. */
export async function publicationState(areaId:string){
 const row:Row|undefined=databaseUrl()?(await(await jurisdictionDb()).query(query,[areaId])).rows[0]:undefined;
 if(!row)return {areaId,status:"missing" as const,publiclyVisible:false,checksPassed:false,canResume:false,publishedRecords:0,reason:"No stored publication exists yet."};
 const publiclyVisible=row.status==="public"&&!!row.approval_id&&!!row.qa_passed&&!!row.data.boundary;
 const blocker=resumeBlocker(areaId,row);
 return {areaId,status:row.status,publiclyVisible,checksPassed:!!row.data.selfCheck?.goLive,canResume:row.status==="paused"&&!blocker,publishedRecords:row.data.applications.length,passRate:row.data.selfCheck?.passRate,checkedAt:row.data.checkedAt,reason:row.status==="paused"?(blocker??"Checks pass, but publication is paused. An explicit Resume publication action is required."):publiclyVisible?"Publication is enabled.":blocker??"Publication remains in review."};
}
/** Only an explicit owner/admin action may clear a durable pause. Refresh never does. */
export async function resumeJurisdiction(areaId:string,reviewer:string){
 requireOnboardingMutation();if(!reviewer.trim())throw Error("Authenticated reviewer required");
 const d=jurisdiction(areaId);if(!d?.enabled||d.legacyPublic)throw Error("Choose an enabled onboarding jurisdiction");
 await jurisdictionTransaction(async tx=>{
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))",["self-check:"+areaId]);
  await tx.query("SELECT data FROM law_jurisdiction_snapshots WHERE area_id=$1 FOR UPDATE",[areaId]);
  const row:Row|undefined=(await tx.query(query+" FOR UPDATE OF p",[areaId])).rows[0];
  if(!row)throw Error("No stored publication exists yet");
  if(row.status==="public"&&row.approval_id&&row.qa_passed)return;
  if(row.status!=="paused")throw Error("Only a paused publication can be resumed");
  const blocker=resumeBlocker(areaId,row);if(blocker)throw Error(blocker);
  await tx.query("UPDATE law_jurisdiction_publications SET status='public',actor=$2,updated_at=now() WHERE area_id=$1",[areaId,reviewer]);
 });
 return publicationState(areaId);
}
