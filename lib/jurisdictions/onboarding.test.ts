import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {mkdtemp,rm} from "node:fs/promises";
import path from "node:path";
import {afterEach,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {AREAS} from "../areas/registry";
import {jurisdiction,publicJurisdictions} from "./registry";
import {registryEntries} from "./generated";
import {validateJurisdictions,contrastWithWhite} from "./validate";
import {computeDeadlines} from "./participation";
import {SourceHttp} from "./http";
import {parseEscribeCalendar,parseEscribeMeeting} from "./adapters/escribe";
import {parseIqm2Calendar,parseIqm2Meeting} from "./adapters/iqm2";
import {parseAdaFiles,adaMeetings} from "./adapters/ada-file-browse";
import {caseNumbers} from "./adapters/common";
import {arcgisAdapter,applicationAdapter} from "./adapters/arcgis";
import {createJurisdictionBudget,withJurisdictionAi} from "./ai-budget";
import {structuredResponse} from "../timeline/extract";
import {JURISDICTIONS} from "../maps/jurisdictions";
const fixture=(name:string)=>readFileSync(path.join(__dirname,"fixtures",name),"utf8");
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
it("validates every definition and keeps staging areas out of the public registry",()=>{
 expect(validateJurisdictions(registryEntries)).toHaveLength(10);
 expect(publicJurisdictions().map(d=>d.id)).toEqual(Object.keys(AREAS));
 expect(AREAS.boise).toBeUndefined();expect(AREAS["ada-county"]).toBeUndefined();
 for(const id of ["boise","ada-county"]){expect(jurisdiction(id)).toMatchObject({launchStatus:"admin_only",enabled:true});expect(contrastWithWhite(jurisdiction(id).color)).toBeGreaterThanOrEqual(4.5);}
 const entries=structuredClone(registryEntries);const boise=entries.find(e=>e.id==="boise")!;boise.launchStatus="public";
 expect(()=>validateJurisdictions(entries)).toThrow("recorded approval");
});
it("preserves the original seven area definitions and ordering",()=>{
 expect(typeof JURISDICTIONS.nampa.recordClient?.getPlan).toBe("function");
 const expected=JSON.parse(fixture("legacy-area-manifest.json"));
 const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):v;
 expect(Object.keys(AREAS)).toEqual(expected.order);
 for(const [id,a]of Object.entries(AREAS)){const plain=JSON.parse(JSON.stringify(a));expect(createHash("sha256").update(JSON.stringify(canonical(plain))).digest("hex"),id).toBe(expected.hashes[id]);}
});
it("computes Boise and Ada deadlines across the DST transition without inventing COB",()=>{
 const boise=jurisdiction("boise"),ada=jurisdiction("ada-county");
 expect(computeDeadlines(boise,"2026-11-02","pz")).toMatchObject([{date:"2026-10-29",startsAt:"2026-10-29T23:00:00.000Z"},{date:"2026-11-02",startsAt:"2026-11-02T19:00:00.000Z"}]);
 expect(computeDeadlines(boise,"2026-11-02","he")[1].startsAt).toBe("2026-11-02T17:00:00.000Z");
 expect(computeDeadlines(ada,"2026-11-18","bocc")).toMatchObject([{date:"2026-11-12",startsAt:undefined},{date:"2026-11-16",startsAt:undefined}]);
 expect(computeDeadlines(ada,"2026-11-18","bocc")[0].label).toContain("not verified");
});
it("parses the recorded eSCRIBE calendar and excludes whole meeting packages",()=>{
 const config=jurisdiction("boise"),source=config.agenda.find(s=>s.adapter==="escribe")!;
 const rows=JSON.parse(fixture("escribe-calendar.json")).d;
 const meetings=parseEscribeCalendar(rows,config,source),m=meetings.find(m=>m.date==="2026-11-02"&&m.body==="pz")!;
 expect(m.startsAt).toBe("2026-11-03T01:00:00.000Z");expect(m.attachments.some(a=>a.kind==="packet")).toBe(true);
 const full=parseEscribeMeeting(fixture("escribe-meeting.html"),m,config);
 expect(full.items.some(i=>i.caseNumbers.includes("CAR26-00013"))).toBe(true);
 expect(full.items.flatMap(i=>i.attachments).some(a=>a.url.includes("DocumentId=921")&&a.kind==="staff_report")).toBe(true);
 expect(parseEscribeCalendar([{...rows[0],MeetingName:"Planning and Zoning Commission Work Session"}],config,source)).toEqual([]);
});
it("keeps Boise Council on iQM2 until its own migration date",()=>{
 const config=jurisdiction("boise"),source=config.agenda.find(s=>s.adapter==="iqm2")!;
 const meetings=parseIqm2Calendar(fixture("iqm2-calendar.html"),config,source);
 expect(meetings.length).toBeGreaterThan(0);expect(meetings.every(m=>m.body==="council"||m.date<"2026-10-14")).toBe(true);
 const m=meetings.find(m=>m.id==="5490")??meetings[0];
 expect(parseIqm2Meeting(fixture("iqm2-meeting.html"),m,config).meetingPageUrl).toBe(m.meetingPageUrl);
});
it("parses messy Ada folders using actual agenda filenames and excludes general BOCC business",()=>{
 const d=jurisdiction("ada-county"),files=parseAdaFiles(fixture("ada-file-tree.html"));expect(files.length).toBeGreaterThan(0);
 const meetings=adaMeetings(files,d,d.agenda[0]);expect(meetings.length).toBeGreaterThan(0);
 expect(meetings.every(m=>/^\d{4}-\d{2}-\d{2}$/.test(m.date)&&m.meetingPageUrl.includes("papp=DS_Agendas"))).toBe(true);
 expect(()=>adaMeetings(files,d,{...d.agenda[0],params:{...d.agenda[0].params,papp:"BOCCAgendas"}})).toThrow("land-use archive");
 expect(caseNumbers(d,"202600638-ZC-DA-S-V")).toEqual(["202600638-ZC-DA-S-V"]);
 expect(caseNumbers(jurisdiction("boise"),"PLN26-01234 linked CAR26-00013")).toEqual(["PLN26-01234","CAR26-00013"]);
});
it("records a Cloudflare response as blocked without retrying and permits a normal CAPTCHA sign-up page",async()=>{
 const cache=await mkdtemp(path.join(tmpdir(),"law-source-test-"));try{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('<html><title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/a"></script></html>',{status:403})).mockResolvedValueOnce(new Response('<html><h1>Testimony sign-up</h1><div class="g-recaptcha"></div></html>'));
  const http=new SourceHttp({fetch:fetcher,cacheDir:cache,delayMs:0});await expect(http.text("https://official.test/report.pdf")).rejects.toThrow("blocked");expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(http.text("https://official.test/signup")).resolves.toContain("sign-up");expect(http.checks[0].state).toBe("blocked");
 }finally{await rm(cache,{recursive:true,force:true});}
});
it("bounds downloads and pages ArcGIS using outSR=4326",async()=>{
 const cache=await mkdtemp(path.join(tmpdir(),"law-arcgis-test-"));try{
  const fetcher=vi.fn().mockImplementation(async url=>{const q=new URL(url).searchParams;return Response.json({type:"FeatureCollection",features:[{type:"Feature",id:q.get("resultOffset"),geometry:null,properties:{}}],exceededTransferLimit:q.get("resultOffset")==="0"});});
  const result=await arcgisAdapter(new SourceHttp({fetch:fetcher,cacheDir:cache,delayMs:0})).query("https://gis.test/FeatureServer/0");expect(result.features).toHaveLength(2);expect(fetcher.mock.calls.every(c=>new URL(c[0]).searchParams.get("outSR")==="4326")).toBe(true);
  const large=new SourceHttp({fetch:vi.fn().mockResolvedValue(new Response("small",{headers:{"content-length":"99999"}})),cacheDir:cache,delayMs:0});await expect(large.request("https://gis.test/report",{},100)).rejects.toThrow("byte cap");
 }finally{await rm(cache,{recursive:true,force:true});}
});
it("enforces monthly, backfill and sample dollar caps in one durable transaction",async()=>{
 const db=new PGlite();try{await db.exec(readFileSync(path.join(__dirname,"../../migrations/20261027_jurisdiction_onboarding.up.sql"),"utf8"));
  const ledger=createJurisdictionBudget(async work=>db.transaction(async tx=>work({query:async(sql:string,values?:unknown[])=>sql.includes("pg_advisory_xact_lock")?{rows:[]}:tx.query(sql,values)} as never)));
  const work={areaId:"ada-county",mode:"backfill" as const,sample:{id:"fixture",maxUsd:1}};
  const id=await ledger.reserve(work,.6);await expect(ledger.reserve(work,.5)).rejects.toThrow("dollar cap");
  const rows=(await db.query<{bucket:string;reserved:number}>("SELECT bucket,reserved FROM law_jurisdiction_ai_budgets")).rows;expect(rows).toHaveLength(3);expect(rows.every(r=>Number(r.reserved)===.6)).toBe(true);
  await ledger.settle(id,"gpt-4.1-mini",{input_tokens:100,output_tokens:20});await ledger.settle(id,"gpt-4.1-mini",{input_tokens:100,output_tokens:20});await expect(ledger.reserve(work,.5)).resolves.toBeTruthy();await expect(ledger.reserve({...work,sample:undefined},5.1)).rejects.toThrow("dollar cap");
 }finally{await db.close();}
});
it("normalizes recorded Boise table and Ada polygon features without inventing dates or addresses",async()=>{
 const cache=await mkdtemp(path.join(tmpdir(),"law-feature-contract-"));
 try{
  const table=new SourceHttp({cacheDir:cache,delayMs:0,fetch:vi.fn().mockImplementation(url=>Promise.resolve(Response.json(String(url).includes("PDS_Zoning_Activities")?JSON.parse(fixture("arcgis-boise.json")):{type:"FeatureCollection",features:[]})))});
  const [boise]=await applicationAdapter(jurisdiction("boise"),table).listApplications();
  expect(boise.recordId).toBe("PLN23-00040");expect(boise.relatedCaseNumbers).toContain("CVA24-00026");expect(boise.geometry).toBeUndefined();expect(boise.received).toBeUndefined();
  const features=JSON.parse(fixture("arcgis-ada-county.json"));
  const gis=new SourceHttp({cacheDir:cache,delayMs:0,fetch:vi.fn().mockResolvedValue(Response.json(features))});
  const [ada]=await applicationAdapter(jurisdiction("ada-county"),gis).listApplications();
  expect(ada.recordId).toBe(features.features[0].properties.APPFILE);expect(ada.geometry?.type).toBe("Polygon");expect(ada.address).toBe("");expect(ada.received).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
 }finally{await rm(cache,{recursive:true,force:true});}
});
it("stops an oversized new-jurisdiction AI request before budget storage or the provider is contacted",async()=>{
 vi.stubEnv("OPENAI_API_KEY","fixture");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 await expect(withJurisdictionAi({areaId:"boise",mode:"backfill"},()=>structuredResponse("fixture",{},[{type:"input_text",text:"a".repeat(70000)}],"fixture"))).rejects.toThrow("per-document token cap");expect(fetcher).not.toHaveBeenCalled();
});
