import {afterEach,expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({collect:vi.fn(),claim:vi.fn()}));
vi.mock("@/lib/jurisdictions/collect",()=>({collectJurisdiction:h.collect}));
vi.mock("@/lib/jurisdictions/onboarding",()=>({validateEndpoints:vi.fn(),sampleAi:vi.fn(),qaReport:vi.fn(),checkRuntimeDocuments:vi.fn()}));
vi.mock("@/lib/timeline/document-work-lease",()=>({claimDocumentWork:h.claim}));
import {GET} from "./route";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it("never exposes staging inventory without authentication and derives the public list from the registry",async()=>{
 vi.stubEnv("CRON_SECRET","fixture");expect((await GET(new Request("https://law.test/api/cron/jurisdictions?scope=ingestion"))).status).toBe(401);
 const r=await GET(new Request("https://law.test/api/cron/jurisdictions",{headers:{authorization:"Bearer fixture"}})),j=await r.json();expect(j.areas).toHaveLength(7);expect(j.areas).not.toContain("boise");expect(j.areas).not.toContain("ada-county");expect(h.claim).not.toHaveBeenCalled();
 const privateList=await GET(new Request("https://law.test/api/cron/jurisdictions?scope=configured",{headers:{authorization:"Bearer fixture"}}));expect((await privateList.json()).areas.sort()).toEqual(["ada-county","boise"]);expect(h.collect).not.toHaveBeenCalled();
});
