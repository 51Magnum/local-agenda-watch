import {afterEach,beforeEach,expect,it,vi} from "vitest";
const payload=(version:string,ids:string[])=>({version,polygons:{type:"FeatureCollection",features:ids.map(id=>({type:"Feature",properties:{id},geometry:{type:"Polygon",coordinates:[]}}))},labels:{type:"FeatureCollection",features:[]},uncovered:{type:"FeatureCollection",features:[]}});
beforeEach(()=>vi.resetModules());afterEach(()=>vi.unstubAllGlobals());
it("revalidates authority with ETags and reuses parsed geometry only on 304",async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(Response.json(payload("one",["boise"]),{headers:{ETag:'W/"one"'}})).mockResolvedValueOnce(new Response(null,{status:304})).mockResolvedValueOnce(Response.json(payload("two",["nampa"]),{headers:{ETag:'W/"two"'}}));vi.stubGlobal("fetch",fetch);
 const {loadAreaBoundaries}=await import("./boundary-client"),first=await loadAreaBoundaries();expect(await loadAreaBoundaries()).toBe(first);expect(fetch.mock.calls[1][1].headers).toEqual({"If-None-Match":'W/"one"'});expect((await loadAreaBoundaries()).polygons.features.map(f=>f.properties.id)).toEqual(["nampa"]);
});
it("falls back to legacy coverage instead of stale published geometry and clears its validator",async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(Response.json(payload("published",["boise"]),{headers:{ETag:'W/"published"'}})).mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(Response.json(payload("legacy",["nampa"]))).mockResolvedValueOnce(Response.json(payload("restored",["nampa"])));vi.stubGlobal("fetch",fetch);
 const {loadAreaBoundaries}=await import("./boundary-client");await loadAreaBoundaries();expect((await loadAreaBoundaries()).polygons.features.map(f=>f.properties.id)).toEqual(["nampa"]);expect(fetch.mock.calls[2][0]).toBe("/map-data/boundaries.json");await loadAreaBoundaries();expect(fetch.mock.calls[3][1].headers).toEqual({});
});
