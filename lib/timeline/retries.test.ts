vi.mock("../ai-budget",()=>({aiBudget:{reserve:vi.fn().mockResolvedValue("reservation"),settle:vi.fn().mockResolvedValue(.0001)},reserveCost:()=>.01}));
import {afterEach,expect,it,vi} from "vitest";
import {ingestDocuments,documentId,officialDocumentUrl} from "./ingest";
import {emptyEvidenceState,EXTRACTED_KEYS,publicFields,type SourceDocument} from "./types";
import {resetDocumentRetry,type EvidenceStore} from "./store";
import {structuredResponse,type Extraction} from "./extract";
import {checkpointRun,withRun} from "./telemetry";
import {sourceRequest} from "./source-access";
const doc:SourceDocument={areaId:"canyon-county",url:"https://landhearingsagenda.canyoncounty.id.gov/DownloadDocument/fixture",title:"Staff report",kind:"staff-report",caseIds:["CR2025-0012"]};
function store():EvidenceStore{const s=emptyEvidenceState();return{read:async()=>structuredClone(s),mutate:async f=>f(s)};}
const empty=()=>Object.fromEntries(EXTRACTED_KEYS.map(k=>[k,{value:null,page:null,quote:null,confidence:0}])) as Extraction;
const deps=()=>({download:vi.fn().mockResolvedValue(new Uint8Array([1])),text:vi.fn().mockResolvedValue([{page:1,text:"This is the official planning staff report document.",method:"native"}]),extract:vi.fn().mockRejectedValue(new Error("Extraction did not complete"))});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it("waits 24 hours after failures, stops at three, and explicit Retry resets the limit",async()=>{
 vi.spyOn(console,"error").mockImplementation(()=>{});vi.useFakeTimers();const start=Date.parse("2026-10-23T12:00:00Z");vi.setSystemTime(start);
 const s=store(),d=deps();await ingestDocuments(s,[doc],d);await ingestDocuments(s,[doc],d);expect(d.extract).toHaveBeenCalledTimes(1);
 vi.setSystemTime(start+86400000-1);await ingestDocuments(s,[doc],d);expect(d.extract).toHaveBeenCalledTimes(1);
 vi.setSystemTime(start+86400000);await ingestDocuments(s,[doc],d);
 vi.setSystemTime(start+2*86400000);await ingestDocuments(s,[doc],d);
 expect((await s.read()).documents[documentId(doc)]).toMatchObject({state:"failed-permanent",failCount:3});
 vi.setSystemTime(start+20*86400000);await ingestDocuments(s,[doc],d);expect(d.extract).toHaveBeenCalledTimes(3);
 await resetDocumentRetry(s,documentId(doc));d.extract.mockResolvedValue(empty());await ingestDocuments(s,[doc],d);
 expect(d.extract).toHaveBeenCalledTimes(4);expect((await s.read()).documents[documentId(doc)].state).toBe("complete");expect((await s.read()).retryAudit).toHaveLength(1);
});
it("a changed SHA-256 resets failures without waiting for cooldown",async()=>{
 vi.spyOn(console,"error").mockImplementation(()=>{});const s=store(),d=deps();await ingestDocuments(s,[doc],d);
 d.download.mockResolvedValue(new Uint8Array([2]));d.extract.mockResolvedValue(empty());await ingestDocuments(s,[doc],d);
 expect(d.extract).toHaveBeenCalledTimes(2);expect((await s.read()).documents[documentId(doc)]).toMatchObject({state:"complete",failCount:0});
});
it("blocked downloads and budget deferrals consume no retry",async()=>{
 vi.spyOn(console,"error").mockImplementation(()=>{});const s=store(),d=deps();d.download.mockRejectedValue(new Error("Document HTTP 403"));
 await ingestDocuments(s,[doc],d);expect((await s.read()).documents[documentId(doc)]).toBeUndefined();
 d.download.mockResolvedValue(new Uint8Array([1]));await ingestDocuments(s,[doc],{...d,budgetMs:2000});
 expect(d.extract).not.toHaveBeenCalled();expect((await s.read()).documents[documentId(doc)].failCount).toBe(0);
});
it("all jurisdictions have isolated evidence and mandatory decision review",async()=>{
 const s=store(),d=deps(),quote="The Board approved this application on October 19, 2026.";
 d.text.mockResolvedValue([{page:1,text:quote,method:"native"}]);d.extract.mockResolvedValue({...empty(),councilDecision:{value:"approved",page:1,quote,confidence:1}});
 await ingestDocuments(s,[{...doc,kind:"council-decision"}],d);const state=await s.read();
 expect(Object.values(state.fields)[0].status).toBe("pending");expect(publicFields(state,doc.caseIds,"canyon-county")).toEqual([]);
 await s.mutate(state=>{Object.values(state.fields)[0].status="approved";});
 expect(publicFields(await s.read(),doc.caseIds)).toEqual([]);expect(publicFields(await s.read(),doc.caseIds,"canyon-county")).toHaveLength(1);
 expect(officialDocumentUrl(doc.url,"meridian")).toBe(false);
 expect(officialDocumentUrl("https://mccmeetings.blob.core.usgovcloudapi.net/meridianid-pubu/file.pdf","meridian")).toBe(true);
 expect(officialDocumentUrl("https://mccmeetings.blob.core.usgovcloudapi.net/other-pubu/file.pdf","meridian")).toBe(false);
});
it("retains usage in memory and checkpoints totals without per-call database logs",async()=>{
 vi.stubEnv("OPENAI_API_KEY","test");vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({status:"incomplete",usage:{input_tokens:100,output_tokens:20,total_tokens:120}})));
 const s=store(),run={startedAt:"test",checked:0,processed:0,skipped:0,errors:[]};
 await expect(withRun(s,run,()=>structuredResponse("case_evidence",{},[],"test"))).rejects.toThrow("did not complete");
 expect((await s.read()).runs).toEqual([]);
 await checkpointRun(s,run);expect((await s.read()).runs[0].tokenTotals).toMatchObject({calls:1,total:120});expect((await s.read()).runs[0].usage).toBeUndefined();
});
it("detects HTTP-200 challenge pages and skips later requests to the same blocked host in a run",async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response("<html>Just a moment cf-chl-token</html>",{headers:{"content-type":"text/html"}}));vi.stubGlobal("fetch",fetch);
 const s=store(),run={startedAt:"test",checked:0,processed:0,skipped:0,errors:[]};await withRun(s,run,async()=>{
  await expect(sourceRequest(doc.url,"canyon-county")).rejects.toThrow("blocked");await expect(sourceRequest(doc.url,"canyon-county")).rejects.toThrow("blocked");
 });expect(fetch).toHaveBeenCalledTimes(1);
});

it("resets a permanently failed fingerprint when new bytes appear",async()=>{
 vi.spyOn(console,"error").mockImplementation(()=>{});vi.useFakeTimers();const start=Date.parse("2026-10-23T12:00:00Z"),s=store(),d=deps();
 for(let i=0;i<3;i++){vi.setSystemTime(start+i*86400000);await ingestDocuments(s,[doc],d);}
 expect((await s.read()).documents[documentId(doc)].state).toBe("failed-permanent");
 d.download.mockResolvedValue(new Uint8Array([99]));d.extract.mockResolvedValue(empty());await ingestDocuments(s,[doc],d);
 expect((await s.read()).documents[documentId(doc)]).toMatchObject({state:"complete",failCount:0});expect(d.extract).toHaveBeenCalledTimes(4);
});
it("persists OCR text before extraction fails so the next run does not pay for OCR again",async()=>{
 vi.spyOn(console,"error").mockImplementation(()=>{});vi.stubEnv("OPENAI_API_KEY","test");vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
 const fetch=vi.fn().mockResolvedValue(Response.json({status:"completed",usage:{input_tokens:30,output_tokens:10,total_tokens:40},output:[{content:[{type:"output_text",text:JSON.stringify({pages:[{page:1,text:"Scanned official planning staff report text."}]})}]}]}));vi.stubGlobal("fetch",fetch);
 const s=store(),d=deps();d.text.mockResolvedValue([{page:1,text:"",method:"native"}]);await ingestDocuments(s,[doc],d);
 expect((await s.read()).documents[documentId(doc)].pages[0].method).toBe("ocr");expect(fetch).toHaveBeenCalledTimes(1);
 vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));d.extract.mockResolvedValue(empty());await ingestDocuments(s,[doc],d);expect(fetch).toHaveBeenCalledTimes(1);
});

it("retains failure limits when an official document moves URL without changing its bytes",async()=>{vi.spyOn(console,"error").mockImplementation(()=>{});const s=store(),d=deps();await ingestDocuments(s,[doc],d);const moved={...doc,url:doc.url+"-new"};await ingestDocuments(s,[moved],d);expect(d.extract).toHaveBeenCalledTimes(1);expect((await s.read()).documents[documentId(doc)].failCount).toBe(1);d.download.mockResolvedValue(new Uint8Array([2]));d.extract.mockResolvedValue(empty());await ingestDocuments(s,[moved],d);expect(d.extract).toHaveBeenCalledTimes(2);});
