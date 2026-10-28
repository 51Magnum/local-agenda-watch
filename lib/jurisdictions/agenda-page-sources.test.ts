import {afterEach,expect,it,vi} from "vitest";
const fixture=vi.hoisted(()=>({snapshot:undefined as unknown}));
vi.mock("./store",()=>({readStaging:async()=>fixture.snapshot}));
vi.mock("../timeline/store",()=>({getEvidenceStore:()=>({read:async()=>({documents:{},fields:{}})})}));
import {privateProject} from "./preview";
import type {StagingSnapshot} from "./store";
afterEach(()=>vi.useRealTimers());
it("links agenda-only facts, next hearings and past history to the physical item page",async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
 const url="https://apps.adacounty.id.gov/AdaFileBrowse/agenda.pdf",snapshot:StagingSnapshot={areaId:"ada-county",launchStatus:"admin_only",checkedAt:"2026-10-28",range:{start:"2026-08-01",end:"2026-12-12"},complete:true,health:[],skipped:[],applications:[],meetings:[{id:"m",title:"PZC",body:"pzc",date:"2026-11-19",startsAt:"2026-11-20T01:00:00Z",meetingPageUrl:url,attachments:[],items:[{itemId:"1",title:"A conditional use for a contractor yard.",caseNumbers:["202601398-CU-MSP"],body:"pzc",meetingDateTime:"2026-11-20T01:00:00Z",meetingPageUrl:url,itemUrl:url+"#page=2",sourcePage:2,attachments:[]}]}]};fixture.snapshot=snapshot;
 const future=await privateProject("ada-county","202601398-CU-MSP");expect(future?.summarySource).toBe(url+"#page=2");expect(future?.next?.sourceUrl).toBe(url+"#page=2");expect(future?.next?.meeting_url).toBe(url+"#page=2");
 snapshot.meetings[0].date="2026-10-15";snapshot.meetings[0].startsAt="2026-10-16T00:00:00Z";const past=await privateProject("ada-county","202601398-CU-MSP");expect(past?.history[0].source).toBe(url+"#page=2");
});
