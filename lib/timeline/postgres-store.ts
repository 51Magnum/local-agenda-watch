import {trackedRows} from "@/lib/db-transfer";
import {Pool,type PoolClient} from "pg";
import {createHash,randomUUID} from "node:crypto";
import type {EvidenceStore} from "./store";
import {DECISION_KEYS, LOW_STAKES_KEYS,emptyEvidenceState,type EvidenceState,type StoredDocument,type EvidenceField} from "./types";
import {compactRun,documentMetadata} from "./compact";
let pool:Pool|undefined,initialized:Promise<void>|undefined;
const db=()=>pool??=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000});
const json=(v:unknown)=>JSON.stringify(v);
const hash=(v:unknown)=>createHash("sha256").update(json(v)).digest("hex");
const schema=`
 CREATE TABLE IF NOT EXISTS law_timeline_documents(id text PRIMARY KEY,area_id text NOT NULL,case_ids text[] NOT NULL,hash text NOT NULL,data jsonb NOT NULL);
 CREATE INDEX IF NOT EXISTS law_timeline_documents_cases ON law_timeline_documents USING gin(case_ids);
 CREATE TABLE IF NOT EXISTS law_timeline_pages(document_id text NOT NULL,hash text NOT NULL,page integer NOT NULL,data jsonb NOT NULL,PRIMARY KEY(document_id,hash,page));
 CREATE TABLE IF NOT EXISTS law_timeline_fields(id text PRIMARY KEY,area_id text NOT NULL,case_id text NOT NULL,document_id text NOT NULL,document_hash text NOT NULL,status text NOT NULL,data jsonb NOT NULL);
 CREATE INDEX IF NOT EXISTS law_timeline_fields_cases ON law_timeline_fields(area_id,case_id);
 CREATE TABLE IF NOT EXISTS law_timeline_audit(id text PRIMARY KEY,data jsonb NOT NULL);
 CREATE TABLE IF NOT EXISTS law_timeline_runs(id text PRIMARY KEY,data jsonb NOT NULL);
 CREATE TABLE IF NOT EXISTS law_timeline_meta(id text PRIMARY KEY,data jsonb NOT NULL);
 CREATE TABLE IF NOT EXISTS law_timeline_leases(id text PRIMARY KEY,token text NOT NULL,expires_at timestamptz NOT NULL);
`;
/** Migration stays inside Postgres: the legacy text archive never crosses the network. */
async function initialize(){
 initialized??=(async()=>{
  const client=await db().connect();try{
   await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(71632024)");await client.query(schema);
   if(!(await client.query("SELECT id FROM law_timeline_meta WHERE id='migration-v2'")).rowCount){
    const exists=(await client.query("SELECT to_regclass('public.law_evidence') AS name")).rows[0]?.name;
    let legacyRowBytes=0;
    if(exists){
     const active=await client.query("SELECT EXISTS(SELECT 1 FROM law_evidence,jsonb_each(coalesce(state->'leases','{}'::jsonb)) lease WHERE id='timeline' AND (lease.value->>'expiresAt')::numeric>extract(epoch from clock_timestamp())*1000) AS active");
     if(active.rows[0]?.active)throw new Error("Timeline migration waits for the active legacy worker to finish; retry shortly");
     legacyRowBytes=Number((await client.query("SELECT octet_length(state::text) AS bytes FROM law_evidence WHERE id='timeline' FOR UPDATE")).rows[0]?.bytes??0);
     await client.query(`INSERT INTO law_timeline_documents SELECT key,coalesce(value->>'areaId','nampa'),ARRAY(SELECT jsonb_array_elements_text(value->'caseIds')),coalesce(value->>'hash',''),(value-'pages'-'content')||jsonb_build_object('structured',value?'content','pageCount',jsonb_array_length(coalesce(value->'pages','[]'::jsonb))) FROM law_evidence,jsonb_each(state->'documents') WHERE id='timeline' ON CONFLICT DO NOTHING`);
     await client.query(`INSERT INTO law_timeline_pages SELECT d.key,d.value->>'hash',(p.value->>'page')::integer,p.value FROM law_evidence,jsonb_each(state->'documents') d,jsonb_array_elements(coalesce(d.value->'pages','[]'::jsonb)) p WHERE id='timeline' ON CONFLICT DO NOTHING`);
     await client.query(`INSERT INTO law_timeline_pages SELECT d.key,d.value->>'hash',(p.value->>'page')::integer,p.value FROM law_evidence,jsonb_each(coalesce(state->'discoveryText','{}'::jsonb)) d,jsonb_array_elements(coalesce(d.value->'pages','[]'::jsonb)) p WHERE id='timeline' ON CONFLICT DO NOTHING`);
     // Unprocessed structured records have content but no page yet; preserve that content once.
     await client.query(`INSERT INTO law_timeline_pages SELECT d.key,coalesce(d.value->>'hash',''),1,jsonb_build_object('page',1,'text',d.value->>'content','method','structured') FROM law_evidence,jsonb_each(state->'documents') d WHERE id='timeline' AND d.value?'content' AND jsonb_array_length(coalesce(d.value->'pages','[]'::jsonb))=0 ON CONFLICT DO NOTHING`);
     await client.query(`INSERT INTO law_timeline_fields SELECT key,coalesce(value->>'areaId','nampa'),value->>'caseId',value->>'documentId',value->>'documentHash',value->>'status',value FROM law_evidence,jsonb_each(state->'fields') WHERE id='timeline' ON CONFLICT DO NOTHING`);
     await client.query(`INSERT INTO law_timeline_audit SELECT md5(a.value::text),a.value FROM law_evidence,jsonb_array_elements(state->'audit') a WHERE id='timeline' ON CONFLICT DO NOTHING`);
     await client.query(`INSERT INTO law_timeline_runs SELECT r.value->>'startedAt',(r.value-'usage')||jsonb_build_object('tokenTotals',coalesce(r.value->'tokenTotals',(SELECT jsonb_build_object('calls',count(*),'input',coalesce(sum((u->>'inputTokens')::bigint),0),'output',coalesce(sum((u->>'outputTokens')::bigint),0),'total',coalesce(sum((u->>'totalTokens')::bigint),0)) FROM jsonb_array_elements(coalesce(r.value->'usage','[]'::jsonb)) u))) FROM law_evidence,jsonb_array_elements(state->'runs') r WHERE id='timeline' ORDER BY r.value->>'startedAt' DESC LIMIT 10 ON CONFLICT DO NOTHING`);
     await client.query(`INSERT INTO law_timeline_meta SELECT 'progress',state-'documents'-'fields'-'audit'-'runs'-'discoveryText'-'leases' FROM law_evidence WHERE id='timeline' ON CONFLICT DO NOTHING`);
    }
    await client.query("INSERT INTO law_timeline_meta VALUES ('migration-v2',$1::jsonb)",[json({legacyRowBytes,migratedAt:new Date().toISOString()})]);
    console.info("[timeline:migration]",json({legacyRowBytes,transferOfLegacyRow:0}));
   }
   await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
 })().catch(error=>{initialized=undefined;throw error;});return initialized;
}
export function createPostgresStore({buffered=false}:{buffered?:boolean}={}):EvidenceStore{
 let state:EvidenceState|undefined,loading:Promise<EvidenceState>|undefined;
 const reviewedBaseline=new Map<string,string>();
 const baseline=new Map<string,string>(),loadedPages=new Set<string>();
 const metrics={readBytes:0,writeBytes:0,queries:0,legacyRowBytes:undefined as number|undefined};
 async function query(client:Pool|PoolClient,sql:string,params:unknown[]=[]){metrics.queries++;metrics.writeBytes+=Buffer.byteLength(json(params));const r=await client.query(sql,params);metrics.readBytes+=Buffer.byteLength(json(trackedRows("timeline",r.rows)));return r;}
 function entries(s:EvidenceState){
  const rows=new Map<string,unknown>();
  for(const d of Object.values(s.documents))rows.set("d:"+d.id,documentMetadata(d));
  for(const f of Object.values(s.fields))rows.set("f:"+f.id,f);
  for(const a of s.audit)rows.set("a:"+hash(a),a);
  for(const r of s.runs.slice(-10))rows.set("r:"+r.startedAt,compactRun(r));
  const {documents:_d,fields:_f,audit:_a,runs:_r,discoveryText:_t,leases:_l,...progress}=s;void _d;void _f;void _a;void _r;void _t;void _l;
  rows.set("m:progress",progress);return rows;
 }
 const read=async()=>{
  if(!state){loading??=(async()=>{
   await initialize();const s=emptyEvidenceState();
   const results=await Promise.all([query(db(),"SELECT data FROM law_timeline_documents"),query(db(),"SELECT data FROM law_timeline_fields"),query(db(),"SELECT data FROM law_timeline_audit"),query(db(),"SELECT data FROM law_timeline_runs ORDER BY id DESC LIMIT 10"),query(db(),"SELECT id,data FROM law_timeline_meta")]);
   for(const row of results[0].rows){const d={...row.data,pages:[]} as StoredDocument;s.documents[d.id]=d;}
   for(const row of results[1].rows){s.fields[row.data.id]=row.data;reviewedBaseline.set(row.data.id,row.data.reviewedAt??"");}
   s.audit=results[2].rows.map(r=>r.data);s.runs=results[3].rows.map(r=>r.data).reverse();
   for(const row of results[4].rows){if(row.id==="progress")Object.assign(s,row.data);if(row.id==="migration-v2")metrics.legacyRowBytes=row.data.legacyRowBytes;}
   for(const [key,value]of entries(s))baseline.set(key,hash(value));state=s;return s;
  })();await loading;}
  return structuredClone(state!);
 };
 async function flush(){
  if(!state)return;await initialize();const rows=entries(state),changes=[...rows].filter(([k,v])=>baseline.get(k)!==hash(v));
  const pageChanges=Object.values(state.documents).filter(d=>d.pages.length&&baseline.get("p:"+d.id)!==hash({hash:d.hash,pages:d.pages}));
  if(!changes.length&&!pageChanges.length)return;
  const client=await db().connect();try{
   await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(71632025)");
   for(const [key,value]of changes){const id=key.slice(2),v=value as Record<string,unknown>;
    if(key.startsWith("d:"))await query(client,"INSERT INTO law_timeline_documents VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO UPDATE SET area_id=excluded.area_id,case_ids=excluded.case_ids,hash=excluded.hash,data=excluded.data",[id,v.areaId??"nampa",v.caseIds,v.hash,json(v)]);
    else if(key.startsWith("f:")){
     const f=value as EvidenceField;
     const result=await query(client,`INSERT INTO law_timeline_fields SELECT $1,$2,$3,$4,$5,$6,$7::jsonb WHERE EXISTS(SELECT 1 FROM law_timeline_documents WHERE id=$4 AND hash=$5) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data WHERE coalesce(law_timeline_fields.data->>'reviewedAt','')=$8 AND (law_timeline_fields.status NOT IN ('approved','rejected') OR excluded.status IN ('approved','rejected') OR $9 OR law_timeline_fields.data->>'key' IS DISTINCT FROM excluded.data->>'key')`,[id,f.areaId??"nampa",f.caseId,f.documentId,f.documentHash,f.status,json(f),reviewedBaseline.get(id)??"",state!.audit.some(a=>a.fieldId===id&&a.action==="undo"&&a.at>= (reviewedBaseline.get(id)??"~"))]);
     if(!result.rowCount)throw new Error("Source document changed during review");
    }
    else if(key.startsWith("a:"))await query(client,"INSERT INTO law_timeline_audit VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING",[id,json(v)]);
    else if(key.startsWith("r:"))await query(client,"INSERT INTO law_timeline_runs VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=excluded.data",[id,json(v)]);
    else await query(client,"INSERT INTO law_timeline_meta VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=excluded.data",[id,json(v)]);
   }
   for(const d of pageChanges){await query(client,`INSERT INTO law_timeline_pages SELECT $1,$2,(p->>'page')::integer,p FROM jsonb_array_elements($3::jsonb) p ON CONFLICT(document_id,hash,page) DO UPDATE SET data=excluded.data`,[d.id,d.hash,json(d.pages)]);}
   await client.query("DELETE FROM law_timeline_runs WHERE id NOT IN (SELECT id FROM law_timeline_runs ORDER BY id DESC LIMIT 10)");
   await client.query("COMMIT");for(const [k,v]of rows)baseline.set(k,hash(v));for(const f of Object.values(state!.fields))reviewedBaseline.set(f.id,f.reviewedAt??"");for(const d of pageChanges)baseline.set("p:"+d.id,hash({hash:d.hash,pages:d.pages}));
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
 }
 return {metrics,read,flush,async mutate(update){if(!state)await read();const result=update(state!);if(!buffered)await flush();return result;},
  async pages(id){if(!state)await read();const d=state!.documents[id];if(!d)return [];
   if(d.pages.length)return structuredClone(d.pages);
   if(!loadedPages.has(id)){
    const rows=await query(db(),"SELECT data FROM law_timeline_pages WHERE document_id=$1 AND hash=$2 ORDER BY page",[id,d.hash]);d.pages=rows.rows.map(r=>r.data);loadedPages.add(id);baseline.set("p:"+id,hash({hash:d.hash,pages:d.pages}));
   }
   return structuredClone(d.pages);
  },
  async readCase(areaId,caseIds){
   await initialize();const s=emptyEvidenceState();
   const [docs,fields]=await Promise.all([query(db(),"SELECT data-'fields'-'validationWarnings' AS data FROM law_timeline_documents WHERE area_id=$1 AND case_ids && $2::text[]",[areaId,caseIds]),query(db(),"SELECT f.data FROM law_timeline_fields f JOIN law_timeline_documents d ON d.id=f.document_id AND d.hash=f.document_hash WHERE f.area_id=$1 AND f.case_id=ANY($2::text[]) AND d.data->>'state'='complete' AND (f.status='approved' OR (f.status='auto_published' AND NOT(f.data->>'key'=ANY($3::text[]))))",[areaId,caseIds,[...DECISION_KEYS].filter(key=>!LOW_STAKES_KEYS.has(key))])]);
   for(const r of docs.rows)s.documents[r.data.id]={...r.data,pages:[]};for(const r of fields.rows)s.fields[r.data.id]=r.data;
   console.info("[timeline:transfer]",json({scope:"public-case-cache-miss",areaId,caseCount:caseIds.length,...metrics}));return s;
  },
  async lease(name,ms){await initialize();const token=randomUUID();const result=await query(db(),"INSERT INTO law_timeline_leases VALUES($1,$2,now()+$3*interval '1 millisecond') ON CONFLICT(id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE law_timeline_leases.expires_at<now() RETURNING token",[name,token,ms]);return result.rowCount?token:null;},
  async release(name,token){await initialize();await query(db(),"DELETE FROM law_timeline_leases WHERE id=$1 AND token=$2",[name,token]);},
 };
}
