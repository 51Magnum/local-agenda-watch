import {expect,it} from "vitest";
import {sourceIsStale,sourceFailureCode,SOURCE_MAX_AGE_MS} from "./source-freshness";
it("keeps fresh cached notices usable through 403s and warns after seven days",()=>{
 const now=Date.parse("2026-10-24T12:00:00Z");
 expect(sourceIsStale(new Date(now-86400000).toISOString(),now)).toBe(false);
 expect(sourceIsStale(new Date(now-SOURCE_MAX_AGE_MS-1).toISOString(),now)).toBe(true);
 expect(sourceIsStale(undefined,now)).toBe(true);expect(sourceIsStale("invalid",now)).toBe(true);
 expect(sourceFailureCode(new Error("Meridian source HTTP 403"))).toBe("HTTP 403");
 expect(sourceFailureCode(new Error("Meridian challenge page"))).toBe("challenge page");
});
