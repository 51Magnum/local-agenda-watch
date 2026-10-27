import { afterEach, expect, it, vi } from "vitest";
import { parsePrimeGovMeetings } from "../sources/primegov";
import { matchPrimeGovCaseNumber, primeGovAdapter } from "./primegov";
import { enrichHearing, NAMPA_PORTAL, NAMPA_COMMENT_RULES, NAMPA_HEARING_BASICS } from "./policies";
import { hearingDeadlines, hearingWithinDays, meetingAction } from "./presentation";
import { hearingKey, type HearingTarget, type HearingMatchRow } from "./types";
import { refreshHearingMeetings } from "./refresh";
import type { Hearing, HearingFeed } from "../localities/types";
import { effectiveHearingFields } from "./store";
import { validateHearingOverride } from "./overrides";
vi.mock("../timeline/extract",()=>({extractNativePdfPages:async()=>[{page:1,text:"9. PUBLIC HEARINGS\nA. Braeburn Creek ANN-00371-2026 / SPP-00184-2026"}]}));
const now=new Date("2026-10-26T18:00:00Z");
const next={startsAt:"2026-11-02T18:00:00-07:00",body:"City Council",location:"City Hall",sourceUrl:"https://www.cityofnampa.us/1433/Upcoming-Public-Hearings"};
const target:HearingTarget={...next,areaId:"nampa",caseId:"ANN-00371-2026",caseIds:["ANN-00371-2026","SPP-00184-2026"],timezone:"America/Denver"};
const published={id:1804,committeeId:1,title:"City Council - Regular Meeting",dateTime:"2026-11-02T17:00:00",templateList:[{id:10,templateId:10,templateName:"HTML Agenda",compileOutputType:3,publishStatus:1},{id:11,templateId:11,templateName:"Packet",compileOutputType:1,publishStatus:1}]};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it("accepts published templateList documents and excludes unpublished templates",()=>{
 const meeting=parsePrimeGovMeetings([{...published,templateList:[...published.templateList,{id:12,templateId:12,templateName:"Minutes",compileOutputType:1,publishStatus:0}]}])[0];
 expect(meeting.meetingUrl).toContain("meetingTemplateId=10");expect(meeting.compiledAgendaUrl).toBe("https://nampa.primegov.com/Public/CompiledDocument?meetingTemplateId=10&compileOutputType=1");expect(meeting.minutesUrl).toBeUndefined();
});
it("matches full case numbers in numbered compiled agenda blocks, including joint cases",()=>{
 const text="8. CONSENT\nA. SPP-00001-2026\n9. PUBLIC HEARINGS\nA. Braeburn Creek ANN-\n00371-2026 and SPP-00184-2026\nB. Another case ANN-99999-2026";
 expect(matchPrimeGovCaseNumber(text,target.caseIds)).toBe("9.A");expect(matchPrimeGovCaseNumber(text,["ANN-00371-20260"])).toBeUndefined();
 expect(matchPrimeGovCaseNumber("9. PUBLIC HEARINGS\nA. ANN-00371-2026\nB. ANN-00371-2026",target.caseIds)).toBeUndefined();
 expect(matchPrimeGovCaseNumber("Braeburn ANN-00371-2026",target.caseIds)).toBeUndefined();
});
it("keeps the hearing's 6 PM time when the matched Council meeting starts at 5 PM",async()=>{
 const fetcher=vi.fn(async(url:string)=>url.includes("ListUpcoming")?Response.json([published]):url.includes("/Portal/Meeting")?new Response('<table><tr><td>9.A.</td><td class="agenda-item"><p>Braeburn ANN-00371-2026</p></td></tr></table>'):new Response(new TextEncoder().encode("%PDF-1.7 test")));
 vi.stubGlobal("fetch",fetcher);const adapter=primeGovAdapter();const matched=await adapter.match(target,await adapter.load());
 expect(matched.meeting_datetime).toBe(next.startsAt);expect(matched.agenda_item_number).toBe("9.A");expect(matched.packet_url).toContain("meetingTemplateId=11");expect(matched.match_status).toBe("published");
 expect(meetingAction(enrichHearing("nampa",next,matched)).label).toBe("View meeting agenda");
});
it("uses the portal when the date/body does not match or no agenda has posted",async()=>{
 const adapter=primeGovAdapter();expect(await adapter.match(target,[])).toMatchObject({meeting_url:NAMPA_PORTAL,match_status:"awaiting-agenda"});
 const wrong=parsePrimeGovMeetings([{...published,committeeId:15}]);const result=await adapter.match(target,wrong);expect(result.agenda_url).toBeUndefined();expect(result.agenda_item_number).toBeUndefined();
});
it("does not publish a compiled document that returns a missing-document page",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockImplementation(()=>Promise.resolve(new Response("<title>Document Not Found</title>"))));const adapter=primeGovAdapter();
 const result=await adapter.match(target,parsePrimeGovMeetings([published]));expect(result.agenda_url).toBeUndefined();expect(result.packet_url).toBeUndefined();expect(result.match_status).toBe("awaiting-agenda");
});
it("does not resurrect an old agenda or packet URL after a successful unpublished-agenda check",()=>{
 const result=enrichHearing("nampa",{...next,agendaUrl:"https://nampa.primegov.com/not-posted",packetUrl:"https://nampa.primegov.com/old-packet"},{meeting_url:NAMPA_PORTAL,match_status:"awaiting-agenda"});
 expect(result.agendaUrl).toBeUndefined();expect(result.packetUrl).toBeUndefined();expect(meetingAction(result).label).toBe("Meeting portal");
});
it("distinguishes the Wednesday staff-report cut-off from hearing-day portal comments across DST",()=>{
 const hearing=enrichHearing("nampa",next);expect(hearing.meeting_body).toBe("Nampa City Council");
 expect(hearing.staff_report_deadline).toBe("2026-10-28T18:00:00.000Z");expect(hearing.comment_deadline).toBe("2026-11-02T19:00:00.000Z");
 expect(hearing.comment_deadline_source_url).toBe(NAMPA_COMMENT_RULES);expect(hearing.staff_report_deadline_source_url).toBe(NAMPA_HEARING_BASICS);expect(hearing.agenda_expected_at).toContain("2026-10-29");
 expect(hearingKey({...target,startsAt:"2026-11-03T01:00:00Z"})).toBe("City Council:2026-11-02");
 expect(meetingAction(hearing).label).toBe("Meeting portal");expect(hearingWithinDays(hearing,"America/Denver",now)).toBe(true);expect(hearingWithinDays(hearing,"America/Denver",new Date("2026-10-01T18:00:00Z"))).toBe(false);
 expect(meetingAction({...hearing,agenda_url:"https://nampa.primegov.com/compiled-agenda"}).url).toBe("https://nampa.primegov.com/compiled-agenda");
});
it("never presents an unsourced deadline, preserves sourced exceptions, and does not invent a special-meeting cut-off",()=>{
 expect(hearingDeadlines({...next,commentDeadline:"2026-11-02T12:00:00-07:00"})).toEqual([]);
 expect(enrichHearing("eagle",{...next,commentDeadline:"2026-11-02"}).commentDeadline).toBeUndefined();
 expect(enrichHearing("nampa",{...next,commentDeadline:"2026-10-30",commentSourceUrl:next.sourceUrl}).commentDeadline).toBe("2026-10-30");
 const special=enrichHearing("nampa",{...next,meeting_kind:"special"});expect(special.commentDeadline).toBeUndefined();expect(special.speak_signup_url).toBeUndefined();
});
const feed:HearingFeed={active:[{appId:target.caseId,appStatus:"Pending",appPhase:"City Council",appPhaseRaw:"City Council",meetings:[{date:"2026-11-02",body:"City Council",bodyLabel:"City Council",dateLabel:"Nov 2",sourceUrl:next.sourceUrl,continuedNote:null}]} as Hearing],completed:[]};
function memory(){const rows=new Map<string,HearingMatchRow>();return {rows,store:{read:async(area:string,id:string,key:string)=>rows.get([area,id,key].join("/")),save:async(row:HearingMatchRow)=>{const id=[row.areaId,row.caseId,row.hearingKey].join("/");rows.set(id,{...structuredClone(row),override:rows.get(id)?.override??row.override});}}};}
it("caps repeated transport failures at three attempts and polls only once per run for joint cases",async()=>{
 const m=memory(),load=vi.fn().mockRejectedValue(Error("Network unavailable"));
 for(const hours of [0,2,6,10])await refreshHearingMeetings({nampa:feed},{now:new Date(now.getTime()+hours*3600000),store:m.store,adapters:{nampa:()=>({load,match:vi.fn()})}});
 expect(load).toHaveBeenCalledTimes(3);expect(m.rows.size).toBe(2);expect([...m.rows.values()].every(r=>r.failureCount===3&&!r.data.last_checked_at)).toBe(true);
});
it("treats an unpublished agenda as a successful poll and preserves a manual correction when it later posts",async()=>{
 const m=memory(),load=vi.fn().mockResolvedValue([]);let agenda=false;
 const adapters={nampa:()=>({load,match:async()=>({meeting_url:agenda?"https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10":NAMPA_PORTAL,match_status:agenda?"published" as const:"awaiting-agenda" as const})})};
 await refreshHearingMeetings({nampa:feed},{now,store:m.store,adapters});const row=[...m.rows.values()][0];expect(row.failureCount).toBe(0);expect(row.data.last_checked_at).toBe(now.toISOString());
 row.override={meeting_url:"https://nampa.primegov.com/public/portal?manual=1"};agenda=true;
 await refreshHearingMeetings({nampa:feed},{now:new Date(now.getTime()+3600000),store:m.store,adapters});
 const updated=[...m.rows.values()][0];expect(updated.data.match_status).toBe("published");expect(effectiveHearingFields(updated).meeting_url).toContain("manual=1");
});
it("requires sourced manual deadlines and rejects unofficial override links",()=>{
 const form=new FormData();form.set("mode","manual");form.set("comment_deadline","2026-11-02T12:00:00-07:00");expect(()=>validateHearingOverride("nampa",form)).toThrow("source URL");
 form.set("comment_deadline_source_url",NAMPA_COMMENT_RULES);expect(validateHearingOverride("nampa",form).comment_deadline).toContain("2026-11-02");
 form.set("meeting_url","https://example.com/not-official");expect(()=>validateHearingOverride("nampa",form)).toThrow("official jurisdiction");
});
