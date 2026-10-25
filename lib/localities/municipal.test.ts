import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {readFileSync} from "node:fs";
import type {HearingFeed} from "./types";
const mocks=vi.hoisted(()=>({save:vi.fn(),read:vi.fn(),extract:vi.fn()}));
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock("./source-cache",()=>({readSourceFeed:mocks.read,saveSourceFeed:mocks.save}));
vi.mock("unpdf",()=>({extractText:mocks.extract}));
import {refreshMunicipalFeed,MUNICIPAL_PUBLIC_FEEDS} from "./municipal";
import {municipalFromFeature} from "@/lib/sources/municipal";
beforeEach(()=>{vi.clearAllMocks();mocks.read.mockResolvedValue(undefined);mocks.save.mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllGlobals());
it("keeps cached Kuna records and marks failures when city sources return 403",async()=>{const old=municipalFromFeature("kuna",{properties:{OBJECTID:7,Project:"Example",Case_No:"26-01-AN",Decision:"Pending"}});mocks.read.mockResolvedValue({active:[old],completed:[],agendaMeetings:[]} satisfies HearingFeed);vi.spyOn(console,"error").mockImplementation(()=>{});vi.stubGlobal("fetch",vi.fn(async()=>new Response("Forbidden",{status:403})));const f=await refreshMunicipalFeed("kuna");expect(f.active[0].appId).toBe("26-01-AN");expect(f.dataUnavailable).toBe(true);expect(f.scheduleUnavailable).toBe(true);vi.restoreAllMocks();});
it("deduplicates Middleton ordinances and caches unchanged PDF extraction",async()=>{
 const fixture=JSON.parse(readFileSync(new URL("./fixtures/middleton-notices.json",import.meta.url),"utf8"));
 mocks.extract.mockResolvedValue({text:"The Middleton City Council is scheduled to hold a public hearing at 5:30 p.m. on Wednesday, November 4, 2026, at 1103 W. Main Street",totalPages:1});
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.includes("api.sanity.io")?Response.json(fixture):new Response("%PDF-"+url,{headers:{"Content-Type":"application/pdf"}})));
 const first=await refreshMunicipalFeed("middleton");expect(first.active).toHaveLength(5);expect(first.active.filter(h=>h.appId==="ORD-723")).toHaveLength(1);expect(first.active.find(h=>h.appId==="ORD-719")?.meetings[0]).toMatchObject({date:"2026-11-04",time:"17:30",body:"City Council"});expect(first.active.every(h=>!h.decisionRecorded)).toBe(true);
 const calls=mocks.extract.mock.calls.length;expect(calls).toBeGreaterThan(0);mocks.read.mockResolvedValue(first);await refreshMunicipalFeed("middleton");expect(mocks.extract).toHaveBeenCalledTimes(calls);
});

it("serves a saved public feed without downloading agendas or transferring its PDF cache",async()=>{
 const saved={active:[],completed:[],refreshedAt:"2026-10-25T00:00:00Z"};
 mocks.read.mockResolvedValue(saved);
 const download=vi.fn();vi.stubGlobal("fetch",download);
 expect(await MUNICIPAL_PUBLIC_FEEDS.kuna()).toEqual(saved);
 expect(mocks.read).toHaveBeenCalledWith("kuna",{omitPdfCache:true});
 expect(download).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});