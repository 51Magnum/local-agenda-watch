import {beforeEach,expect,it,vi} from "vitest";
import posted from "../../tests/fixtures/braeburn-posted-agenda.json";
const h=vi.hoisted(()=>({read:vi.fn(),posted:vi.fn()}));
vi.mock("./store",async original=>({...await original<typeof import("./store")>(),readHearingMatch:h.read}));
vi.mock("./posted-meeting",()=>({postedMeeting:h.posted}));
import {resolveHearingMeeting} from "./resolver";
import {meetingAction} from "./presentation";
const next={startsAt:"2026-11-02T18:00:00-07:00",body:"City Council",location:"City Hall",sourceUrl:"https://www.cityofnampa.us/1433/Upcoming-Public-Hearings"};
beforeEach(()=>{h.read.mockReset().mockResolvedValue({data:{match_status:"awaiting-agenda",meeting_url:"https://nampa.primegov.com/public/portal"},override:{}});h.posted.mockReset().mockResolvedValue({...posted.result,last_checked_at:"2026-11-01T18:00:00Z"});});
it("replaces Braeburn's stale portal with the verified November 2 agenda without a storage write",async()=>{
 const result=await resolveHearingMeeting("nampa","ANN-00371-2026",next);
 expect(result.agenda_url).toBe(posted.result.agenda_url);expect(meetingAction(result).url).toBe(posted.result.agenda_url);expect(result.startsAt).toBe(next.startsAt);expect(h.posted).toHaveBeenCalledWith("nampa","ANN-00371-2026",expect.objectContaining({body:"City Council",startsAt:next.startsAt}));
});
it("honors a reviewer who explicitly withholds an agenda",async()=>{h.read.mockResolvedValue({data:{match_status:"awaiting-agenda"},override:{agenda_url:null}});const result=await resolveHearingMeeting("nampa","ANN-00371-2026",next);expect(result.agenda_url).toBeUndefined();expect(h.posted).not.toHaveBeenCalled();});
it("preserves existing verified agendas and uses them ahead of generic portals",async()=>{h.read.mockResolvedValue({data:{match_status:"published",agenda_url:posted.result.agenda_url,meeting_url:"https://nampa.primegov.com/public/portal"},override:{}});expect(meetingAction(await resolveHearingMeeting("nampa","ANN-00371-2026",next)).url).toBe(posted.result.agenda_url);expect(h.posted).not.toHaveBeenCalled();});
it("retains the sourced fallback when the official host cannot be checked",async()=>{h.posted.mockRejectedValue(Error("Unavailable"));const result=await resolveHearingMeeting("nampa","ANN-00371-2026",next);expect(result.agenda_url).toBeUndefined();expect(result.startsAt).toBe(next.startsAt);});
it("retains Canyon's posted event record instead of replacing it with the generic portal",async()=>{h.read.mockResolvedValue(undefined);h.posted.mockResolvedValue(undefined);const sourceUrl="https://landhearingsagenda.canyoncounty.id.gov/Landing?eventId=447";const result=await resolveHearingMeeting("canyon-county","SD2026-0003",{...next,body:"Board of County Commissioners",sourceUrl});expect(meetingAction(result).url).toBe(sourceUrl);expect(meetingAction(result).label).toBe("View meeting record");});

it("keeps reviewer overrides authoritative when a posted agenda fills missing automatic fields",async()=>{h.read.mockResolvedValue({data:{match_status:"awaiting-agenda"},override:{meeting_url:"https://official.test/reviewed-meeting",agenda_item_number:"9.C"}});const result=await resolveHearingMeeting("nampa","ANN-00371-2026",next);expect(result.agenda_url).toBe(posted.result.agenda_url);expect(result.meeting_url).toBe("https://official.test/reviewed-meeting");expect(result.agenda_item_number).toBe("9.C");});
