import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { composeCountyFeed, parseCountyEvent } from "@/lib/sources/canyon-county";
import type { HearingFeed } from "@/lib/localities/types";
vi.mock("@/lib/localities/canyon-county",()=>({getCanyonCountyHearings:vi.fn()}));
vi.mock("@/lib/maps/store",()=>({readMapSnapshot:async()=>undefined}));
import {getCanyonCountyHearings}from "@/lib/localities/canyon-county";
import {CountyCasePage,CountyCaseMetadata,CountyCalendar,CountyMeetings}from "./canyon-county-pages";
const now=new Date("2026-10-23T12:00:00-06:00");
let feed:HearingFeed;
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(now);
 const event=(id:number)=>parseCountyEvent(readFileSync(new URL("../sources/fixtures/canyon-county/event-"+id+".html",import.meta.url),"utf8"),String(id));
 feed=composeCountyFeed([{properties:{PermitNum:"SD2025-0002",AppType:"PLAT - Preliminary",AppSubmitted:Date.parse("2025-01-29"),Status:"Active",ApprovalStatus:"In Progress"}}],[event(381),event(438)],now);
 vi.mocked(getCanyonCountyHearings).mockResolvedValue(feed);
});
afterEach(()=>vi.useRealTimers());
const params=()=>Promise.resolve({planNumber:"SD2025-0002"});
it("renders a County project with its Board date, actual deadline, linked history and deduplicated reports",async()=>{
 const html=renderToStaticMarkup(await CountyCasePage({params:params()}));
 expect(html).toContain("Pheasant Heights");expect(html).toContain("Thursday, October 29, 2026");expect(html).toContain("1:30 PM MDT");expect(html).toContain("Monday, October 19, 2026 (time not specified)");expect(html).toContain("Recommended Approval");expect(html).not.toContain("City Council");expect(html).not.toContain("Nampa");expect(html.match(/href="https:\/\/landhearingsagenda.canyoncounty.id.gov\/DownloadDocument\/1467"/g)).toHaveLength(1);
});
it("sets canonical case metadata and a calendar using the County hearing's actual time",async()=>{
 const meta=await CountyCaseMetadata({params:params()});expect(meta.alternates?.canonical).toBe("https://www.localagendawatch.com/us/id/canyon-county/plan/SD2025-0002");
 const response=await CountyCalendar(new Request("http://localhost"),{params:params()});expect(response.status).toBe(200);const ics=await response.text();expect(ics).toContain("DTSTART:20261029T193000Z");expect(ics).toContain("/us/id/canyon-county/plan/SD2025-0002");
});
it("case-filtered meetings link directly to official event records and their results",async()=>{
 const html=renderToStaticMarkup(await CountyMeetings({searchParams:Promise.resolve({case:"SD2025-0002"})}));expect(html).toContain("eventId=381");expect(html).toContain("Recommended Approval");expect(html).toContain("eventId=438");
});
it("a decided case hides Next step and returns no hearing calendar",async()=>{
 const h=feed.active[0];h.decisionRecorded=true;h.appStatus="Denied";
 feed={...feed,active:[],completed:[h]};vi.mocked(getCanyonCountyHearings).mockResolvedValue(feed);
 const html=renderToStaticMarkup(await CountyCasePage({params:params()}));expect(html).not.toContain('id="next-step-title"');expect(html).toContain("Denied");expect((await CountyCalendar(new Request("http://localhost"),{params:params()})).status).toBe(404);
});
