import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({authorized:true,save:vi.fn()}));
vi.mock("next/cache",()=>({revalidateTag:vi.fn()}));
vi.mock("@/lib/timeline/auth",async original=>({...await original<typeof import("@/lib/timeline/auth")>(),authorizedReviewer:()=>state.authorized}));
vi.mock("@/lib/hearings/store",()=>({saveHearingOverride:state.save}));
import { POST } from "./route";
function request(deadline=false){const form=new FormData();form.set("area","nampa");form.set("case","ANN-00371-2026");form.set("hearing","City Council:2026-11-02");form.set("mode","manual");form.set("meeting_url","https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10");if(deadline)form.set("comment_deadline","2026-11-02T12:00:00-07:00");return new Request("https://site.test/admin/review/hearing-action",{method:"POST",headers:{origin:"https://site.test"},body:form});}
beforeEach(()=>{state.authorized=true;state.save.mockReset();});afterEach(()=>vi.unstubAllGlobals());
it("rejects unauthenticated manual edits before saving or fetching",async()=>{state.authorized=false;const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);expect((await POST(request())).status).toBe(403);expect(state.save).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();});
it("rejects an unsourced deadline and a dead meeting URL",async()=>{const fetcher=vi.fn().mockResolvedValue(new Response("Missing",{status:404}));vi.stubGlobal("fetch",fetcher);expect((await POST(request(true))).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();expect((await POST(request())).status).toBe(400);expect(state.save).not.toHaveBeenCalled();});
it("saves a verified official override scoped to this exact hearing",async()=>{vi.stubGlobal("fetch",vi.fn().mockImplementation(()=>Promise.resolve(new Response("<html>Official meeting</html>"))));const response=await POST(request());expect(response.status).toBe(303);expect(state.save).toHaveBeenCalledWith("nampa","ANN-00371-2026","City Council:2026-11-02",expect.objectContaining({meeting_url:"https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10",match_status:"published"}));});
