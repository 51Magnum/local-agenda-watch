import {afterEach,expect,it,vi}from "vitest";
import{readFileSync}from "node:fs";
import{composeMeridianFeed,parseMeridianNotices,parseMeridianMeetings,parseMeridianAgenda,meridianFromFeature,meridianStage,meridianHtml,MERIDIAN_PORTALS}from "./meridian";
import{getCaseNextHearing}from "@/lib/case-details";
const fixture=(name:string)=>readFileSync(new URL("./fixtures/meridian/"+name,import.meta.url),"utf8");
const now=new Date("2026-10-23T12:00:00-06:00");
const momentum={properties:{App_ID:"H-2026-0036",Name:"Momentum Subdivision - CPAM, MDA, PP, RZ",Active:"Y",Action:"Pending",Hearing_Type:"Planning and Zoning",Appr_Date:Date.parse("2026-10-01"),PP:"Y",workflow_status:"Accepted",workflow_status_date:"2026-06-12"}};
afterEach(()=>vi.unstubAllGlobals());
it("reads the dated notice row and ignores erroneous continuance years in the narrative",()=>{
 const notices=parseMeridianNotices(fixture("notices.html"));expect(notices).toHaveLength(23);expect(notices.find(n=>n.caseIds.includes("H-2026-0036"))).toMatchObject({date:"2026-11-05",body:"P&Z",title:"Momentum Subdivision"});expect(notices.find(n=>n.caseIds.includes("H-2026-0028"))?.date).toBe("2027-01-05");
 expect(notices.find(n=>n.caseIds.includes("H-2026-0057"))?.caseIds).toEqual(["H-2026-0057"]);
});
it("does not turn Active=Y or a GIS date into approval or a hearing date",()=>{
 const feed=composeMeridianFeed([momentum],parseMeridianNotices(fixture("notices.html")),[],now),h=feed.active.find(h=>h.appId==="H-2026-0036")!;
 expect(h.displayTitle).toBe("Momentum Subdivision");expect(h.decisionRecorded).toBe(false);expect(meridianStage(h,now)).toBe("P&Z");expect(getCaseNextHearing(h,feed,now,"meridian")).toMatchObject({startsAt:"2026-11-05",body:"Planning & Zoning Commission"});expect(getCaseNextHearing(h,feed,now,"meridian")?.commentDeadline).toBeUndefined();
});
it("keeps P&Z approval in review until a final outcome is established",()=>{
 const h=meridianFromFeature({properties:{...momentum.properties,Action:"Approved"}});expect(meridianStage(h,now)).toBe("In review");
 const council=meridianFromFeature({properties:{...momentum.properties,Action:"Denied",Hearing_Type:"City Council"}});expect(meridianStage(council,now)).toBe("Decided");
});
it("parses official agenda and minutes links and excludes cancelled work sessions",()=>{
 const meetings=parseMeridianMeetings(fixture("council.html"),"City Council",MERIDIAN_PORTALS["City Council"]);expect(meetings.some(m=>/cancel|work session/i.test(m.title))).toBe(false);expect(meetings.find(m=>m.date==="2026-10-27")).toMatchObject({localStartTime:"18:00"});expect(meetings.find(m=>m.date==="2026-10-20")?.minutesUrl).toContain("MEET-Minutes-");
});
it("joins linked case IDs from their own agenda-item heading, retaining minutes as a separate source",()=>{
 const meeting=parseMeridianMeetings(fixture("pz.html"),"P&Z",MERIDIAN_PORTALS["P&Z"])[0];meeting.items=parseMeridianAgenda(fixture("agenda.html"),meeting.htmlAgendaUrl!);
 const item=meeting.items.find(i=>i.caseIds.includes("H-2026-0044"))!;expect(item.caseIds).toEqual(["H-2026-0044","SHP-2026-0008"]);
 const feed=composeMeridianFeed([{properties:{App_ID:"H-2026-0044",Name:"Mom's Empire"}}],[],[meeting],now);expect(feed.active[0].meetings[0].minutesUrl).toContain("MEET-Minutes-");expect(feed.active[0].meetings[0].result).toBeUndefined();
});
it("treats citywide notices as unpinned changes",()=>{
 const feed=composeMeridianFeed([],parseMeridianNotices(fixture("notices.html")),[],now);expect(feed.active.find(h=>h.appId==="ZOA-2026-0001")?.citywide).toBe(true);expect(feed.active.find(h=>h.appId==="H-2026-0037")?.citywide).toBe(true);expect(feed.active.find(h=>h.appId==="H-2026-0036")?.citywide).toBe(false);
});
it("rejects forbidden or challenge pages instead of reporting no upcoming hearings",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("Forbidden",{status:403})));await expect(meridianHtml("https://apps.meridiancity.org/notice")).rejects.toThrow("403");
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("<title>Just a moment</title>")));await expect(meridianHtml("https://apps.meridiancity.org/notice")).rejects.toThrow("challenge");expect(()=>parseMeridianNotices("<p>Denied</p>")).toThrow();
});

it("a consent-agenda case reference is not advertised as a new public hearing",()=>{const meeting=parseMeridianMeetings(fixture("council.html"),"City Council",MERIDIAN_PORTALS["City Council"])[0];meeting.items=[{title:"2.Findings of Fact, Conclusions of Law for Momentum (H-2026-0036)",caseIds:["H-2026-0036"],agendaUrl:meeting.agendaUrl!,staffReports:[]}];const feed=composeMeridianFeed([momentum],[],[meeting],now);expect(feed.active[0].meetings).toHaveLength(0);});
it("joins an unnumbered notice to a GIS case only by the same official document-folder ID",()=>{const notice=parseMeridianNotices(fixture("notices.html")).find(n=>!n.caseIds.length)!;const feed=composeMeridianFeed([{properties:{App_ID:"H-2026-0038",Name:"2026 Comprehensive Plan Text Amendment",Weblink:notice.filesUrl}}],[notice],[],now);expect(feed.active[0].citywide).toBe(true);expect(feed.active[0].meetings[0].date).toBe("2026-10-27");});
