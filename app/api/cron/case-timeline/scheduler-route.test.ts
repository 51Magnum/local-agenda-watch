import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {emptySchedule} from "@/lib/timeline/schedule";
import {emptyEvidenceState} from "@/lib/timeline/types";
vi.mock("next/cache",()=>({revalidateTag:vi.fn()}));
vi.mock("@/lib/timeline/schedule-store",()=>({scheduleSlotCompleted:vi.fn(async()=>false),scheduleDue:vi.fn(async()=>false),readSchedule:vi.fn(async()=>emptySchedule()),claimSchedule:vi.fn(async()=>"schedule-token"),releaseSchedule:vi.fn()}));
vi.mock("@/lib/timeline/store",()=>({getEvidenceStore:vi.fn(()=>({read:async()=>emptyEvidenceState()})),acquireLease:vi.fn(async()=>"ingest-token"),releaseLease:vi.fn()}));
vi.mock("@/lib/timeline/refresh",()=>({refreshTimelines:vi.fn(async()=>({run:{checked:3,processed:1,skipped:2,errors:[]},feeds:{},checkedCases:{}}))}));
import {scheduleSlotCompleted,scheduleDue,readSchedule,releaseSchedule,claimSchedule} from "@/lib/timeline/schedule-store";
import {getEvidenceStore} from "@/lib/timeline/store";
import {refreshTimelines} from "@/lib/timeline/refresh";
import {GET} from "./route";
const invoke=(query="")=>GET(new Request("https://example.com/api/cron/case-timeline"+query,{headers:{authorization:"Bearer secret"}}));
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-24T20:00:00Z"));vi.stubEnv("CRON_SECRET","secret");vi.stubEnv("OPENAI_API_KEY","test");vi.clearAllMocks();});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
it("successfully skips an out-of-window scheduled invocation with zero database calls",async()=>{
 vi.setSystemTime(new Date("2026-10-24T10:59:00Z"));
 expect((await invoke()).status).toBe(200);expect(scheduleDue).not.toHaveBeenCalled();expect(readSchedule).not.toHaveBeenCalled();expect(getEvidenceStore).not.toHaveBeenCalled();
});
it("uses only the tiny schedule gate when an afternoon has no work",async()=>{
 const r=await invoke();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({status:"skipped",checked:0});
 expect(scheduleDue).toHaveBeenCalledOnce();expect(readSchedule).not.toHaveBeenCalled();expect(getEvidenceStore).not.toHaveBeenCalled();expect(refreshTimelines).not.toHaveBeenCalled();
});
it("forces a full sweep manually, logs counts, and saves the meeting index",async()=>{
 const r=await invoke("?manual=1&force=1");expect(await r.json()).toMatchObject({modes:["forced-full-sweep"],checked:3});
 expect(scheduleDue).not.toHaveBeenCalled();expect(refreshTimelines).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({includeMaps:true,plan:expect.objectContaining({fullSweep:true})}));
 expect(releaseSchedule).toHaveBeenCalledWith("schedule-token",expect.objectContaining({updatedAt:expect.any(String)}));
});

it("allows an already completed slot as a successful no-op",async()=>{vi.mocked(scheduleSlotCompleted).mockResolvedValueOnce(true);const r=await invoke();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({alreadyCompleted:true,status:"skipped"});});
it("reports an active scheduler as a successful skipped run with a reason",async()=>{
 vi.mocked(claimSchedule).mockResolvedValueOnce(null as never);const r=await invoke("?manual=1&force=1");expect(r.status).toBe(200);expect(await r.json()).toMatchObject({status:"skipped",reason:"Scheduler already running"});
});
it("retains failure status for a real schedule-storage error",async()=>{
 vi.mocked(scheduleDue).mockRejectedValueOnce(new Error("Storage unavailable"));expect((await invoke()).status).toBe(503);
});
