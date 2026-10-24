import {expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {emptyEvidenceState,type EvidenceField} from "./types";
const harness=vi.hoisted(()=>({db:null as unknown,queries:[] as string[]}));
vi.mock("pg",()=>({Pool:class{
 async query(sql:string,params?:unknown[]){harness.queries.push(sql);const db=harness.db as PGlite;
 if(sql.includes("pg_advisory_xact_lock"))return {rows:[],rowCount:1};
 const r=(!params?.length&&sql.includes(";"))?(await db.exec(sql)).at(-1)!:await db.query(sql,params);
 return {...r,rowCount:r.affectedRows??r.rows.length};}
 async connect(){return {query:this.query.bind(this),release:()=>{}};}
}}));
import {reviewBatch,undoBatch} from "./review";
import {createPostgresStore} from "./postgres-store";
it("migrates inside Postgres, reads metadata once, writes deltas, and fetches only one case without page text",async()=>{
 const db=new PGlite();harness.db=db;
 const state=emptyEvidenceState(),large="Official report content ".repeat(100000);
 const document={id:"d1",areaId:"nampa",url:"https://www.cityofnampa.us/report.pdf",title:"Staff report",caseIds:["ONE"],kind:"staff-report" as const,hash:"v1",checkedAt:"",state:"complete" as const,pages:[{page:1,text:large,method:"native" as const}]};
 state.discoveryText={d1:{hash:"v1",pages:document.pages,checkedAt:""}};
 state.documents.d1=document;state.documents.d2={...document,id:"d2",caseIds:["TWO"],hash:"v2"};
 const f:EvidenceField={id:"f1",documentId:"d1",documentHash:"v1",areaId:"nampa",caseId:"ONE",key:"councilDecision",value:"approved",page:1,quote:"approved",sourceUrl:document.url,sourceKind:"council-decision",confidence:1,status:"pending",createdAt:""};state.fields.f1=f;
 state.fields.f2={...f,id:"f2",key:"acres",value:"10",status:"auto_published"};
 await db.exec("CREATE TABLE law_evidence(id text PRIMARY KEY,state jsonb NOT NULL)");await db.query("INSERT INTO law_evidence VALUES('timeline',$1::jsonb)",[JSON.stringify(state)]);
 const store=createPostgresStore({buffered:true}),first=await store.read();expect(first.documents.d1.pages).toEqual([]);expect(first.fields.f1.status).toBe("pending");expect((await db.query("SELECT count(*)::integer AS n FROM law_timeline_pages")).rows[0]).toEqual({n:2});
 // New structured content lives in one pages row, never duplicated in metadata.
 await store.mutate(s=>{s.documents.structured={...document,id:"structured",hash:"structured-v1",kind:"case-record",caseIds:["STRUCT"],content:"ApplyDate: 2026-10-01",pages:[{page:1,text:"ApplyDate: 2026-10-01",method:"structured"}]};});await store.flush!();
 const structured=(await db.query<{data:Record<string,unknown>}>("SELECT data FROM law_timeline_documents WHERE id='structured'")).rows[0].data;
 expect(structured.content).toBeUndefined();expect(structured.pages).toBeUndefined();
 const afterRead=harness.queries.length;await store.read();await store.mutate(s=>{s.documents.d1.failCount=1;});expect(harness.queries.length).toBe(afterRead);
 await store.flush!();expect(store.metrics!.readBytes).toBeLessThan(15000);expect(store.metrics!.legacyRowBytes).toBeGreaterThan(4000000);
 expect((await store.pages!("d1"))[0].text).toBe(large);const afterPages=store.metrics!.readBytes;await store.pages!("d1");expect(store.metrics!.readBytes).toBe(afterPages);
 const publicStore=createPostgresStore(),publicState=await publicStore.readCase!("nampa",["ONE"]);
 expect(Object.keys(publicState.documents)).toEqual(["d1"]);expect(publicState.documents.d1.pages).toEqual([]);expect(Object.keys(publicState.fields)).toEqual(["f2"]);expect(publicStore.metrics!.readBytes).toBeLessThan(5000);
 // A manual approval saved during a worker session must survive the worker's later checkpoint.
 const reviewer=createPostgresStore();await reviewer.mutate(s=>{s.fields.f1.status="approved";});await store.mutate(s=>{s.documents.d1.checkedAt="later";});await store.flush!();
 expect((await createPostgresStore().readCase!("nampa",["ONE"])).fields.f1.status).toBe("approved");
 const lease=await store.lease!("ingest",60000);expect(lease).toBeTruthy();expect(await publicStore.lease!("ingest",60000)).toBeNull();await store.release!("ingest",lease!);
 expect(await publicStore.lease!("ingest",60000)).toBeTruthy();
 const editing=createPostgresStore();const reviewed=await reviewBatch(editing,[{id:"f2",action:"approve",value:"11"}]);
 expect((await createPostgresStore().read()).fields.f2.value).toBe("11");
 await undoBatch(createPostgresStore(),reviewed.batchId);
 expect((await createPostgresStore().read()).fields.f2).toMatchObject({status:"auto_published",value:"10"});
 const stale=createPostgresStore();await stale.read();await reviewBatch(createPostgresStore(),[{id:"f2",action:"reject"}]);
 await expect(reviewBatch(stale,[{id:"f2",action:"approve"}])).rejects.toThrow("Source document changed");
 await db.close();
},30000);
