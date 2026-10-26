import {afterEach,expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({send:vi.fn(),store:vi.fn()}));
vi.mock("@/lib/alerts",()=>({alertReadiness:()=>({deliveryEnabled:false}),sendDigests:h.send}));
vi.mock("@/lib/timeline/store",()=>({getEvidenceStore:h.store,acquireLease:vi.fn(),releaseLease:vi.fn()}));
import {GET} from "./route";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it("keeps an unapproved scheduled run away from recipients, storage, and delivery",async()=>{
 vi.stubEnv("CRON_SECRET","test-cron");
 const response=await GET(new Request("https://preview.test/api/cron/alerts",{headers:{authorization:"Bearer test-cron"}}));
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({sent:0});expect(h.store).not.toHaveBeenCalled();expect(h.send).not.toHaveBeenCalled();
 expect((await GET(new Request("https://preview.test/api/cron/alerts"))).status).toBe(401);
});
