import {afterEach,expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({collect:vi.fn(async()=>({areaId:"boise",complete:true})),claim:vi.fn(),check:vi.fn(async()=>({areaId:"boise",goLive:false})),ensure:vi.fn(),state:vi.fn(async()=>({areaId:"boise",status:"paused",canResume:true})),resume:vi.fn(),projection:vi.fn()}));
vi.mock("@/lib/jurisdictions/collect",()=>({collectJurisdiction:h.collect}));
vi.mock("@/lib/jurisdictions/run-self-check",()=>({runSelfCheck:h.check}));
vi.mock("@/lib/jurisdictions/migrations",()=>({ensureOnboardingSchema:h.ensure}));
vi.mock("@/lib/jurisdictions/publication-state",()=>({publicationState:h.state,resumeJurisdiction:h.resume}));
vi.mock("@/lib/jurisdictions/publication-projection",()=>({refreshPublicationProjection:h.projection}));
vi.mock("@/lib/jurisdictions/onboarding",()=>({validateEndpoints:vi.fn(),sampleAi:vi.fn(),qaReport:vi.fn(),checkRuntimeDocuments:vi.fn()}));
vi.mock("@/lib/timeline/document-work-lease",()=>({claimDocumentWork:h.claim}));
import {GET} from "./route";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const request=(command:string)=>new Request("https://local.test/api/cron/jurisdictions?area=boise&command="+command,{headers:{authorization:"Bearer test-secret"}});
it("runs bounded metadata collection separately from publication checks",async()=>{vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("CRON_SECRET","test-secret");expect((await GET(request("collect"))).status).toBe(200);expect(h.collect).toHaveBeenCalledWith("boise",expect.objectContaining({write:true,selfCheck:false,budgetMs:140000}));expect(h.check).not.toHaveBeenCalled();});
it("runs the existing publication gate in its own request",async()=>{vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("CRON_SECRET","test-secret");expect((await GET(request("check"))).status).toBe(200);expect(h.check).toHaveBeenCalledWith("boise",{reports:false});expect(h.collect).not.toHaveBeenCalled();});
it("keeps both phases disabled in Preview",async()=>{vi.stubEnv("VERCEL_ENV","preview");expect((await GET(request("collect"))).status).toBe(403);expect(h.collect).not.toHaveBeenCalled();});
it("reads private publication status without migrations, collection or writes",async()=>{
 vi.stubEnv("CRON_SECRET","test-secret");const response=await GET(request("status"));
 expect(await response.json()).toMatchObject({status:"paused",canResume:true});expect(response.headers.get("cache-control")).toContain("no-store");
 expect(h.ensure).not.toHaveBeenCalled();expect(h.collect).not.toHaveBeenCalled();expect(h.resume).not.toHaveBeenCalled();
});
it("allows explicit authenticated resume only through the guarded service",async()=>{
 vi.stubEnv("CRON_SECRET","test-secret");expect((await GET(request("resume"))).status).toBe(200);
 expect(h.resume).toHaveBeenCalledWith("boise","workflow-owner");expect(h.projection).toHaveBeenCalledWith("boise");
});
it("refuses failed resume and disables status/resume in Preview",async()=>{
 vi.stubEnv("CRON_SECRET","test-secret");h.resume.mockRejectedValueOnce(Error("Current gate failed"));
 expect((await GET(request("resume"))).status).toBe(409);expect(h.projection).not.toHaveBeenCalled();
 vi.stubEnv("VERCEL_ENV","preview");expect((await GET(request("resume"))).status).toBe(403);expect((await GET(request("status"))).status).toBe(403);
});

it("never exposes staging inventory without authentication and derives the public list from the registry",async()=>{
 vi.stubEnv("CRON_SECRET","fixture");expect((await GET(new Request("https://law.test/api/cron/jurisdictions?scope=ingestion"))).status).toBe(401);
 const r=await GET(new Request("https://law.test/api/cron/jurisdictions",{headers:{authorization:"Bearer fixture"}})),j=await r.json();expect(j.areas).toHaveLength(7);expect(j.areas).not.toContain("boise");expect(j.areas).not.toContain("ada-county");expect(h.claim).not.toHaveBeenCalled();
 const privateList=await GET(new Request("https://law.test/api/cron/jurisdictions?scope=configured",{headers:{authorization:"Bearer fixture"}}));expect((await privateList.json()).areas.sort()).toEqual(["ada-county","boise"]);expect(h.collect).not.toHaveBeenCalled();
});
