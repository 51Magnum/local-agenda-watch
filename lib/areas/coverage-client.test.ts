import {afterEach,expect,it,vi} from "vitest";
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it("uses server geometry checks and shares one bounded request for area and nearby-map routing",async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({area:{id:"nampa"},mapUrl:"/us/id/map?lat=43.600000&lng=-116.500000&r=1&nearby=1"}));vi.stubGlobal("fetch",fetch);
 const {liveAreaAtPoint,locationMapUrl}=await import("./coverage-client"),coords:[number,number]=[-116.5,43.6];
 expect(await liveAreaAtPoint(coords)).toEqual({id:"nampa"});expect(await locationMapUrl(coords,"Main Street")).toContain("&q=Main%20Street");expect(fetch).toHaveBeenCalledOnce();expect(fetch).toHaveBeenCalledWith("/api/map/coverage",expect.objectContaining({method:"POST"}));
});
it("leaves failed geometry checks unknown rather than inventing coverage",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("Unavailable",{status:503})));
 const {liveAreaAtPoint,locationMapUrl}=await import("./coverage-client");expect(await liveAreaAtPoint([0,0])).toBeUndefined();expect(await locationMapUrl([0,0])).toBeUndefined();
});
