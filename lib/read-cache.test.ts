import { afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({cached:vi.fn().mockResolvedValue("cached")}));
vi.mock("next/cache",()=>({unstable_cache:()=>mocks.cached}));
import {readCache} from "./read-cache";
afterEach(()=>{vi.unstubAllEnvs();mocks.cached.mockClear();});
it("keeps the Next cache for normal requests and bypasses it for a standalone read-only audit",async()=>{
 const load=vi.fn().mockResolvedValue("fresh"),read=readCache(load);
 expect(await read()).toBe("cached");expect(load).not.toHaveBeenCalled();
 vi.stubEnv("LAW_READ_ONLY","true");expect(await read()).toBe("fresh");expect(load).toHaveBeenCalledOnce();expect(mocks.cached).toHaveBeenCalledOnce();
});
