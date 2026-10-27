import {afterEach,expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({send:vi.fn(),store:vi.fn(),readiness:vi.fn(()=>({ready:true,deliveryEnabled:false,waitlistEnabled:false}))}));
vi.mock("@/lib/alerts",()=>({alertReadiness:h.readiness,sendDigests:h.send}));
vi.mock("@/lib/timeline/store",()=>({getEvidenceStore:h.store,acquireLease:vi.fn(),releaseLease:vi.fn()}));
import {GET} from "./route";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it("keeps an unapproved scheduled run away from recipients, storage, and delivery",async()=>{
 vi.stubEnv("CRON_SECRET","test-cron");
 const response=await GET(new Request("https://preview.test/api/cron/alerts",{headers:{authorization:"Bearer test-cron"}}));
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({sent:0});expect(h.store).not.toHaveBeenCalled();expect(h.send).not.toHaveBeenCalled();
 expect((await GET(new Request("https://preview.test/api/cron/alerts"))).status).toBe(401);
});

it("reports authenticated readiness without sending mail or touching storage", async () => {
 vi.stubEnv("CRON_SECRET", "test-cron");
 h.readiness.mockReturnValueOnce({ready:true,deliveryEnabled:true,waitlistEnabled:false});
 const request = new Request("https://production.test/api/cron/alerts?status=1", {headers:{authorization:"Bearer test-cron"}});
 const response = await GET(request);
 expect(await response.json()).toEqual({ready:true,deliveryEnabled:true,waitlistEnabled:false});
 expect(response.headers.get("cache-control")).toBe("no-store");
 expect(h.send).not.toHaveBeenCalled(); expect(h.store).not.toHaveBeenCalled();
 expect((await GET(new Request(request.url))).status).toBe(401);
});
it("reports missing mail configuration accurately", async () => {
 vi.stubEnv("CRON_SECRET", "test-cron");
 h.readiness.mockReturnValueOnce({ready:false,deliveryEnabled:true,waitlistEnabled:false});
 const response=await GET(new Request("https://production.test/api/cron/alerts?status=1",{headers:{authorization:"Bearer test-cron"}}));
 expect(await response.json()).toMatchObject({ready:false,deliveryEnabled:true});
 expect(h.send).not.toHaveBeenCalled(); expect(h.store).not.toHaveBeenCalled();
});
