import {beforeEach,expect,it,vi} from "vitest";
import {emptyEvidenceState,type SourceDocument} from "./types";
import type {EvidenceStore} from "./store";
import type {SchedulePlan} from "./schedule";
vi.mock("./discover",()=>({discoverCaseDocuments:vi.fn()}));
vi.mock("./ingest",async importOriginal=>({...await importOriginal<typeof import("./ingest")>(),ingestDocuments:vi.fn()}));
vi.mock("@/lib/maps/refresh",()=>({refreshConfiguredMaps:vi.fn()}));
import {discoverCaseDocuments} from "./discover";
import {documentId,ingestDocuments} from "./ingest";
import {EXTRACTION_VERSION} from "./extract";
import {refreshTimelines} from "./refresh";
const docs:SourceDocument[]=[
 {areaId:"nampa",url:"https://www.cityofnampa.us/staff.pdf",title:"Staff report",kind:"staff-report",caseIds:["CASE"]},
 {areaId:"nampa",url:"https://www.cityofnampa.us/agenda.pdf",title:"Agenda",kind:"agenda",caseIds:["CASE"]},
 {areaId:"nampa",url:"https://www.cityofnampa.us/case",title:"Case",kind:"case-record",caseIds:["CASE"],content:"case"},
 {areaId:"nampa",url:"https://www.cityofnampa.us/decision.pdf",title:"Decision",kind:"council-decision",caseIds:["CASE"]},
];
const makeStore=()=>{
 const state=emptyEvidenceState();for(const d of docs)state.documents[documentId(d)]={...d,id:documentId(d),hash:"v1",extractionVersion:EXTRACTION_VERSION,state:"complete",checkedAt:"2026-10-01",pages:[]};
 const store:EvidenceStore={read:async()=>state,mutate:async update=>update(state)};return store;
};
const plan:SchedulePlan={slot:"today:am",fullSweep:true,modes:["daily-sweep"],meetingIds:[],recheckCaseIdsByArea:{}};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(discoverCaseDocuments).mockResolvedValue({documents:docs,warnings:[],caseIds:["CASE"],extractedPages:new Map(),feeds:{}});});
it("daily discovery skips completed PDFs not due for follow-up but retains unfinished/new evidence",async()=>{
 const store=makeStore();delete (await store.read()).documents[documentId(docs[3])];
 await refreshTimelines(store,{plan,includeMaps:false});
 expect(vi.mocked(ingestDocuments).mock.calls[0][1].map(d=>d.kind)).toEqual(["case-record","council-decision"]);
});
it("daily follow-up rechecks completed PDFs for due cases",async()=>{
 await refreshTimelines(makeStore(),{plan:{...plan,recheckCaseIdsByArea:{nampa:["CASE"]}},includeMaps:false});
 expect(vi.mocked(ingestDocuments).mock.calls[0][1]).toEqual(docs);
});
it("pre-hearing checks only agendas and staff reports/packets and scopes discovery",async()=>{
 const p={...plan,fullSweep:false,modes:["pre-hearing"],caseIdsByArea:{nampa:["CASE"]}};
 await refreshTimelines(makeStore(),{plan:p,includeMaps:false,meetingDatesByArea:{nampa:["2026-10-26"]}});
 expect(vi.mocked(ingestDocuments).mock.calls[0][1].map(d=>d.kind)).toEqual(["staff-report","agenda"]);
 expect(discoverCaseDocuments).toHaveBeenCalledWith(expect.objectContaining({caseIdsByArea:p.caseIdsByArea,meetingDatesByArea:{nampa:["2026-10-26"]}}));
});
it("manual full sweep rechecks completed documents",async()=>{
 await refreshTimelines(makeStore(),{plan:{...plan,modes:["forced-full-sweep"]},includeMaps:false});
 expect(vi.mocked(ingestDocuments).mock.calls[0][1]).toEqual(docs);
});
