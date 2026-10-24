import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { composeCountyFeed, collectCountyEvents, countyStage, countyTitle, parseCountyEvent, parseCountyMonth } from "./canyon-county";
import { getCaseNextHearing } from "@/lib/case-details";
import { buildMapSnapshot } from "@/lib/maps/refresh";
import { JURISDICTIONS } from "@/lib/maps/jurisdictions";
const fixture=(name:string)=>readFileSync(new URL("./fixtures/canyon-county/"+name,import.meta.url),"utf8");
const now=new Date("2026-10-23T12:00:00-06:00");
const feature=(id="SD2025-0002",account="R3445012A0")=>({type:"Feature" as const,properties:{PermitNum:id,ACCOUNT:account,AppType:"PLAT - Preliminary",AppSubmitted:Date.parse("2025-01-08"),Status:"Active",ApprovalStatus:"In Progress",ParcelAddress:"23854 Emmett Rd., Caldwell"},geometry:{type:"Polygon" as const,coordinates:[[[-116.7,43.8],[-116.69,43.8],[-116.69,43.81],[-116.7,43.81],[-116.7,43.8]]]}});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("Canyon County sources",()=>{
 it("parses published case IDs, dates, authority, exact deadlines and official documents",()=>{
  const e=parseCountyEvent(fixture("event-438.html"),"438");
  expect(e).toMatchObject({caseIds:["SD2025-0002"],date:"2026-10-29",time:"13:30",startsAt:"2026-10-29T19:30:00.000Z",deadline:"2026-10-19",body:"Board of County Commissioners",linkedIds:["328","381"]});
  expect(e.documents.find(d=>d.label==="Staff Report")?.url).toBe("https://landhearingsagenda.canyoncounty.id.gov/DownloadDocument/1467");
  expect(parseCountyMonth(fixture("month.html"))).toContain("447");
 });
 it("deduplicates parcel fragments and retains P&Z recommendation separately from upcoming Board action",()=>{
  const feed=composeCountyFeed([feature(),feature(undefined,"R3445012B0")],[parseCountyEvent(fixture("event-381.html"),"381"),parseCountyEvent(fixture("event-438.html"),"438")],now);
  expect(feed.active).toHaveLength(1);expect(feed.completed).toHaveLength(0);const h=feed.active[0];expect(countyStage(h,now)).toBe("Council/Board");
  expect((h as import("./canyon-county").CountyCase).county.address).toBe("23854 Emmett Rd., Caldwell");
  expect(countyTitle(h)).toBe("Pheasant Heights · preliminary plat");
  expect(h.meetings[0].result).toBe("Recommended Approval");
  expect(getCaseNextHearing(h,feed,now,"canyon-county")).toMatchObject({body:"Board of County Commissioners",commentDeadline:"2026-10-19",startsAt:"2026-10-29T19:30:00.000Z"});
 });
 it("supports Hearing Examiner and does not infer a result from an elapsed date",()=>{
  const e=parseCountyEvent(fixture("event-441.html"),"441"),feed=composeCountyFeed([feature("SD2026-0001")],[e],now);
  expect(e.body).toBe("Hearing Examiner");expect(e.result).toBeUndefined();expect(countyStage(feed.active[0],now)).toBe("Hearing Examiner");expect(feed.completed).toHaveLength(0);
 });
 it("includes ordinance hearings without treating site-specific ordinance case IDs as countywide",()=>{
  const e=parseCountyEvent(fixture("event-419.html"),"419");expect(e).toMatchObject({caseIds:["OR2025-0019"],countywide:true,body:"P&Z",date:"2026-11-05",deadline:"2026-10-26"});
  const feed=composeCountyFeed([feature("OR2025-0027")],[e],now);expect(feed.active.find(h=>h.appId==="OR2025-0019")?.citywide).toBe(true);expect(feed.active.find(h=>h.appId==="OR2025-0027")?.citywide).toBe(false);
 });
 it("a final official denial is Decided, while a P&Z recommendation alone stays in review",()=>{
  const recommendation=parseCountyEvent(fixture("event-381.html"),"381");const feed=composeCountyFeed([feature()],[recommendation],now);expect(feed.active).toHaveLength(1);expect(countyStage(feed.active[0],now)).toBe("In review");
  const denied={...parseCountyEvent(fixture("event-438.html"),"438"),date:"2026-10-19",result:"Denied"};const decided=composeCountyFeed([feature()],[recommendation,denied],now);expect(decided.completed).toHaveLength(1);expect(countyStage(decided.completed[0],now)).toBe("Decided");expect(getCaseNextHearing(decided.completed[0],decided,now,"canyon-county")).toBeUndefined();
 });
 it("reports 403 or challenge markup as failures and keeps cached hearing events",async()=>{
  vi.spyOn(console,"error").mockImplementation(()=>{});const previous=parseCountyEvent(fixture("event-438.html"),"438");vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("Forbidden",{status:403})));
  const result=await collectCountyEvents(now,[previous]);expect(result.unavailable).toBe(true);expect(result.events).toEqual([previous]);
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("<title>Just a moment...</title>")));expect((await collectCountyEvents(now,[previous])).unavailable).toBe(true);
 });
 it("County map joins all parcel polygons to one case and generates canonical County links",async()=>{
  const features=[feature(),feature(undefined,"R3445012B0")],feed=composeCountyFeed(features,[parseCountyEvent(fixture("event-438.html"),"438")],now);
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json({type:"FeatureCollection",features})));
  const config={...JURISDICTIONS["canyon-county"],loadCases:async()=>feed};
  const snapshot=await buildMapSnapshot(config,{version:1,jurisdiction:config.id,updatedAt:now.toISOString(),cases:[],warnings:[],flum:{updatedAt:new Date().toISOString(),geojson:{type:"FeatureCollection",features:[]},legend:[]}});
  expect(snapshot.cases).toHaveLength(1);expect(snapshot.cases[0]).toMatchObject({id:"SD2025-0002",geometry:{type:"MultiPolygon"},href:"/us/id/canyon-county/plan/SD2025-0002",source:"polygon"});
 });
});
