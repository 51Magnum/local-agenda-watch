import {afterEach,expect,it,vi} from "vitest";
vi.mock("./discover",()=>({discoverNampaDocuments:vi.fn(async()=>({documents:[],warnings:[],caseIds:[],extractedPages:new Map()}))}));
import {discoverCaseDocuments,prioritizeCases,recordDocuments} from "./discover-areas";
import {AREAS} from "@/lib/areas/registry";
import {countyFromFeature} from "@/lib/sources/canyon-county";
import {meridianFromFeature} from "@/lib/sources/meridian";
import {emptyEvidenceState,type SourceDocument} from "./types";
import type {EvidenceStore} from "./store";
import {walkLibrary} from "./libraries";
import {ingestDocuments,documentId} from "./ingest";
const emptyFeed=()=>({active:[],completed:[]});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
it("defaults to all active jurisdictions and finds county staff reports without a database record",async()=>{
 delete process.env.TIMELINE_CASE_IDS;
 const h=countyFromFeature({properties:{PermitNum:"AD2025-0020-APL"}});
 h.county.events=[{id:"1",caseIds:[h.appId],name:"Appeal",address:"",body:"Board of County Commissioners",date:"2026-11-02",startsAt:"2026-11-02",sourceUrl:"https://landhearingsagenda.canyoncounty.id.gov/Landing?eventId=1",linkedIds:[],documents:[{label:"Staff report",filename:"staff.pdf",url:"https://agenda.canyoncounty.id.gov/DownloadDocument/1",sourceUrl:"https://agenda.canyoncounty.id.gov/"}]}];
 const run={startedAt:"test",checked:0,processed:0,skipped:0,errors:[],areas:{}};
 const feeds=Object.fromEntries(Object.keys(AREAS).map(id=>[id,emptyFeed()]));feeds["canyon-county"]={active:[h] as never[],completed:[]};
 const found=await discoverCaseDocuments({feeds,run,deadline:Date.now()+1000});
 expect(found.documents.some(d=>d.areaId==="canyon-county"&&d.kind==="staff-report")).toBe(true);
 expect(Object.keys(run.areas)).toHaveLength(7);expect(found.caseIds).toContain(h.appId);
 const m=meridianFromFeature({properties:{App_ID:"H-2026-0047"}});
 expect(recordDocuments(AREAS.meridian,m).some(d=>/query\?/.test(d.url))).toBe(false);
});
it("prioritizes upcoming hearings before undated backlog and newest hearings next",()=>{
 const make=(id:string,date:string)=>({...countyFromFeature({properties:{PermitNum:id}}),meetings:date?[{body:"P&Z",bodyLabel:"Planning",date,dateLabel:date,continuedNote:null,sourceUrl:"https://agenda.canyoncounty.id.gov/"}]:[]});
 const cases=[make("OLD","2025-01-01"),make("NEW","2026-10-01"),make("NEXT","2026-11-02")];
 expect(prioritizeCases(cases,"America/Denver",new Date("2026-10-23T12:00:00Z")).map(h=>h.appId)).toEqual(["NEXT","NEW","OLD"]);
});
it("descends into an agency subfolder, prefers the final report, and caches its physical page provenance",async()=>{
 const root="https://weblink.meridiancity.org/WebLink/Browse.aspx?id=1",folder="https://weblink.meridiancity.org/WebLink/Browse.aspx?id=2";
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>new Response(url===root?'<a href="'+folder+'">Agency Comments</a>':'<a href="/WebLink/ACHD%20FINAL.pdf">ACHD FINAL.pdf</a><a href="/WebLink/ACHD%20DRAFT.pdf">ACHD DRAFT.pdf</a>',{headers:{"content-type":"text/html"}})));
 const state=emptyEvidenceState(),store:EvidenceStore={read:async()=>structuredClone(state),mutate:async fn=>fn(state)};
 const files=await walkLibrary("meridian","H-2026-0047",root,store,Date.now()+10000);
 expect(files).toHaveLength(1);expect(files[0].title).toBe("ACHD FINAL.pdf");
 const doc:SourceDocument={...files[0],areaId:"meridian",caseIds:["H-2026-0047"],kind:"agenda",fields:[]};
 await ingestDocuments(store,[doc],{download:async()=>new Uint8Array([1]),text:async()=>[{page:1,text:"B. Vicinity Map showing the proposed development site.",method:"native"}]});
 expect((await store.read()).documents[documentId(doc)].pages[0]).toMatchObject({page:1,method:"native"});
 expect((await store.read()).documents[documentId(doc)].hash).toHaveLength(64);
});

it("matches previously deferred agenda OCR to cases and discovers minutes without calling OCR again",async()=>{
 const state=emptyEvidenceState(),h=countyFromFeature({properties:{PermitNum:"CR2025-0012"}}),url="https://landhearingsagenda.canyoncounty.id.gov/DownloadDocument/agenda";
 const d:SourceDocument={areaId:"canyon-county",url,title:"Agenda",caseIds:[],kind:"agenda",fields:[],meeting:{body:"Board of County Commissioners",date:"2026-11-02",isHearing:false,minutesUrl:"https://landhearingsagenda.canyoncounty.id.gov/DownloadDocument/minutes"}};
 state.documents[documentId(d)]={...d,id:documentId(d),hash:"cached",pages:[{page:1,text:"Public hearing CR2025-0012",method:"ocr"}],checkedAt:"",state:"complete"};
 const s:EvidenceStore={read:async()=>structuredClone(state),mutate:async fn=>fn(state)};
 const feeds=Object.fromEntries(Object.keys(AREAS).map(id=>[id,emptyFeed()]));feeds["canyon-county"]={active:[h] as never[],completed:[]};
 const found=await discoverCaseDocuments({store:s,feeds,deadline:Date.now()+1000});
 expect(found.documents.find(d=>d.url===url)?.caseIds).toEqual([h.appId]);expect(found.documents.some(d=>d.kind==="minutes"&&d.caseIds.includes(h.appId))).toBe(true);
});
