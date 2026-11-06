import {createHash} from "node:crypto";
import {caseNumbers} from "./adapters/common";
import {contentHash,snapshotHash} from "./snapshot-hash";
import {verificationUrl,restrictedRecordData,sourceRecordId} from "./record-links";
import {officialRedirect} from "./official-redirect";
import type {JurisdictionDefinition} from "./types";
import type {StagingSnapshot} from "./store";
import type {LinkEvidence} from "./self-check";
export type EvidenceCache={read:(cycle:string)=>Promise<Record<string,LinkEvidence>>;write:(cycle:string,url:string,proof:LinkEvidence)=>Promise<void>};
/** Reused only for this exact staged collection, configuration and two-hour cycle. */
export function cachedEvidence(d:JurisdictionDefinition,snapshot:StagingSnapshot,read:(url:string)=>Promise<LinkEvidence>,cache:EvidenceCache){
 const cycle=contentHash([snapshotHash(snapshot),snapshot.checkedAt,d.recordLinks,d.applications.params.publicFields,"source-evidence-v1"]),ready=cache.read(cycle);
 return async(url:string)=>{
  const saved=await ready;if(saved[url])return saved[url];const proof=await read(url);
  if(![200,302,403].includes(proof.status))return proof;
  const app=snapshot.applications.find(a=>verificationUrl(d,sourceRecordId(d,a))===url);
  if(app&&!restrictedRecordData(d,url,proof.text,sourceRecordId(d,app)))return proof;
  if(proof.status===302&&(!proof.redirectUrl||!officialRedirect(url,proof.redirectUrl,d.recordLinks?.redirects)))return proof;
  const minimal:LinkEvidence={...proof,evidenceHash:proof.evidenceHash??createHash("sha256").update(proof.text).digest("hex"),text:app?proof.text:caseNumbers(d,proof.text).join(" ")};
  if(minimal.text.length<=256000){await cache.write(cycle,url,minimal);saved[url]=minimal;}
  return minimal;
 };
}
export async function productionEvidenceCache(areaId:string):Promise<EvidenceCache>{
 const {requireOnboardingMutation}=await import("../runtime-environment");requireOnboardingMutation();
 const {ensureOnboardingSchema}=await import("./migrations");await ensureOnboardingSchema();
 const db=await(await import("./store")).jurisdictionDb();
 await db.query("DELETE FROM law_jurisdiction_source_evidence WHERE area_id=$1 AND updated_at<now()-interval '2 hours'",[areaId]);
 return {
  read:async cycle=>{const r=await db.query("SELECT url,data FROM law_jurisdiction_source_evidence WHERE area_id=$1 AND cycle_hash=$2 AND updated_at>=now()-interval '2 hours'",[areaId,cycle]);return Object.fromEntries(r.rows.map(r=>[r.url,r.data]));},
  write:async(cycle,url,proof)=>{requireOnboardingMutation();await db.query("INSERT INTO law_jurisdiction_source_evidence(area_id,cycle_hash,url,url_hash,data) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(area_id,cycle_hash,url_hash) DO UPDATE SET data=excluded.data,updated_at=now()",[areaId,cycle,url,createHash("sha256").update(url).digest("hex"),JSON.stringify(proof)]);}
 };
}
