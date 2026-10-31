import {AsyncLocalStorage} from "node:async_hooks";
import {randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import {jurisdiction} from "./registry";
import {jurisdictionDb,jurisdictionTransaction} from "./store";
import {usageCost,type Usage} from "../ai-budget";
export type AiWork={areaId:string;mode:"monthly"|"backfill";sample?:{id:string;maxUsd:number};documentHash?:string};
const context=new AsyncLocalStorage<AiWork>();
export function withJurisdictionAi<T>(work:AiWork,run:()=>Promise<T>){return context.run(work,run);}
export const currentJurisdictionAi=()=>context.getStore();
type Transaction=<T>(work:(tx:Pick<PoolClient,"query">)=>Promise<T>)=>Promise<T>;
export function budgetBuckets(work:AiWork,now=new Date()){const d=jurisdiction(work.areaId);if(!d)throw Error("Unknown jurisdiction AI budget");return[{bucket:"month:"+now.toISOString().slice(0,7),limit:d.legacyPublic?Infinity:d.costCaps.monthlyUsd},...(work.mode==="backfill"?[{bucket:"backfill",limit:d.legacyPublic?Infinity:d.costCaps.backfillUsd}]:[]),...(work.sample?[{bucket:"sample:"+work.sample.id,limit:work.sample.maxUsd}]:[])];}
async function releaseStale(tx:Pick<PoolClient,"query">,areaId:string,now:Date){
 const r=await tx.query("SELECT * FROM law_jurisdiction_ai_calls WHERE area_id=$1 AND cost IS NULL AND created_at < $2::timestamptz - interval '1 hour' FOR UPDATE",[areaId,now.toISOString()]);
 for(const call of r.rows){for(const bucket of call.buckets)await tx.query("UPDATE law_jurisdiction_ai_budgets SET reserved=greatest(0,reserved-$3) WHERE area_id=$1 AND bucket=$2",[areaId,bucket,call.reservation]);await tx.query("UPDATE law_jurisdiction_ai_calls SET cost=0,input_tokens=0,output_tokens=0 WHERE id=$1 AND cost IS NULL",[call.id]);}
 return r.rows.length;
}
export function createJurisdictionBudget(transaction:Transaction){return{
 async reconcile(areaId:string,now=new Date()){return transaction(async tx=>{await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))",["jurisdiction-ai:"+areaId]);return releaseStale(tx,areaId,now);});},
 async reserve(work:AiWork,amount:number,now=new Date()){
  if(!Number.isFinite(amount)||amount<0)throw Error("Invalid jurisdiction AI reservation");
  return transaction(async tx=>{await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))",["jurisdiction-ai:"+work.areaId]);await releaseStale(tx,work.areaId,now);const buckets=budgetBuckets(work,now);
   for(const {bucket,limit}of buckets){await tx.query("INSERT INTO law_jurisdiction_ai_budgets(area_id,bucket) VALUES($1,$2) ON CONFLICT DO NOTHING",[work.areaId,bucket]);const r=await tx.query("SELECT spent,reserved FROM law_jurisdiction_ai_budgets WHERE area_id=$1 AND bucket=$2 FOR UPDATE",[work.areaId,bucket]);if(Number(r.rows[0].spent)+Number(r.rows[0].reserved)+amount>limit)throw Error("AI work deferred: jurisdiction "+work.areaId+" "+bucket+" dollar cap reached");}
   for(const {bucket}of buckets)await tx.query("UPDATE law_jurisdiction_ai_budgets SET reserved=reserved+$3 WHERE area_id=$1 AND bucket=$2",[work.areaId,bucket,amount]);
   const id=randomUUID();await tx.query("INSERT INTO law_jurisdiction_ai_calls(id,area_id,buckets,reservation) VALUES($1,$2,$3,$4)",[id,work.areaId,buckets.map(b=>b.bucket),amount]);return id;
  });
 },
 async settle(id:string,model:string,usage:Usage){return transaction(async tx=>{const r=await tx.query("SELECT * FROM law_jurisdiction_ai_calls WHERE id=$1 FOR UPDATE",[id]);const call=r.rows[0];if(!call||call.cost!=null)return;const cost=usageCost(model,usage);for(const bucket of call.buckets)await tx.query("UPDATE law_jurisdiction_ai_budgets SET reserved=greatest(0,reserved-$3),spent=spent+$4 WHERE area_id=$1 AND bucket=$2",[call.area_id,bucket,call.reservation,cost]);await tx.query("UPDATE law_jurisdiction_ai_calls SET cost=$2,input_tokens=$3,output_tokens=$4 WHERE id=$1",[id,cost,usage.input_tokens??0,usage.output_tokens??0]);return cost;});}
};}
export const jurisdictionAiBudget=createJurisdictionBudget(jurisdictionTransaction);
export async function jurisdictionSpend(areaId:string){const r=await(await jurisdictionDb()).query("SELECT bucket,spent,reserved FROM law_jurisdiction_ai_budgets WHERE area_id=$1 ORDER BY bucket",[areaId]);return r.rows.map(x=>({bucket:x.bucket,spent:Number(x.spent),reserved:Number(x.reserved)}));}
