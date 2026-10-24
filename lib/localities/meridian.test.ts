import {afterEach,expect,it,vi} from "vitest";
import type {HearingFeed} from "./types";
const mocks=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),html:vi.fn()}));
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}));
vi.mock("./source-cache",()=>({readSourceFeed:mocks.read,saveSourceFeed:mocks.save}));
vi.mock("@/lib/maps/gis",()=>({geoQuery:async()=>({features:[]})}));
vi.mock("@/lib/sources/meridian",async importOriginal=>({...await importOriginal<typeof import("@/lib/sources/meridian")>(),meridianHtml:mocks.html,parseMeridianMeetings:()=>[]}));
import {refreshMeridianFeed} from "./meridian";
import {MERIDIAN_NOTICES} from "@/lib/sources/meridian";
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it.each([["2026-10-24T12:00:00Z",false],["2026-11-02T12:00:00Z",true]])("retains verified notices on a 403; stale warning at %s is %s",async(now,stale)=>{
 vi.useFakeTimers();vi.setSystemTime(new Date(now));mocks.read.mockResolvedValue(undefined);mocks.save.mockResolvedValue(undefined);
 mocks.html.mockImplementation(async(url:string)=>{if(url===MERIDIAN_NOTICES)throw new Error("Meridian source HTTP 403");return "index";});
 const log=vi.spyOn(console,"error").mockImplementation(()=>{});
 const feed=await refreshMeridianFeed();
 expect(feed.scheduleUnavailable).toBe(stale);expect(feed.scheduleRefreshedAt).toBe("2026-10-24T00:16:42.300Z");expect(feed.active.length).toBeGreaterThan(0);
 expect(log).toHaveBeenCalledWith(expect.stringContaining("HTTP 403"));
 const saved=mocks.save.mock.calls.at(-1)![1] as HearingFeed;expect(saved.scheduleRefreshedAt).toBe(feed.scheduleRefreshedAt);
});
