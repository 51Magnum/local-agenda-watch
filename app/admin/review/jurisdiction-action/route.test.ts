import {afterEach,expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({resume:vi.fn(),projection:vi.fn(),pause:vi.fn(),decide:vi.fn(),path:vi.fn(),tag:vi.fn()}));
vi.mock("@/lib/jurisdictions/publication-state",()=>({resumeJurisdiction:h.resume}));
vi.mock("@/lib/jurisdictions/publication-projection",()=>({refreshPublicationProjection:h.projection}));
vi.mock("@/lib/jurisdictions/self-check-store",()=>({pauseJurisdiction:h.pause,decideException:h.decide}));
vi.mock("next/cache",()=>({revalidatePath:h.path,revalidateTag:h.tag}));
import {POST} from "./route";
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();});
function request(authorized=true,origin="https://law.test"){
 vi.stubEnv("REVIEW_ADMIN_PASSWORD","fixture-password");
 return new Request("https://law.test/admin/review/jurisdiction-action",{method:"POST",headers:{origin,...authorized?{authorization:"Basic "+Buffer.from("admin:fixture-password").toString("base64")}:{}},body:new URLSearchParams({areaId:"ada-county",action:"resume"})});
}
it("resumes through the current admin identity and refreshes the public projection",async()=>{
 const response=await POST(request());expect(response.status).toBe(303);expect(h.resume).toHaveBeenCalledWith("ada-county","admin");expect(h.projection).toHaveBeenCalledWith("ada-county");
});
it("blocks missing auth and cross-origin resume before writes",async()=>{
 expect((await POST(request(false))).status).toBe(401);expect((await POST(request(true,"https://other.test"))).status).toBe(403);expect(h.resume).not.toHaveBeenCalled();
});
it("keeps failed and Preview resume unavailable",async()=>{
 h.resume.mockRejectedValueOnce(Error("Staging changed"));expect((await POST(request())).status).toBe(409);expect(h.projection).not.toHaveBeenCalled();
 vi.stubEnv("VERCEL_ENV","preview");expect((await POST(request())).status).toBe(403);expect(h.resume).toHaveBeenCalledOnce();
});
