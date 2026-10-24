import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { locationMapUrl } from "@/lib/areas/coverage";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function request(query: string) { return new Request("http://localhost/api/locations/search", { method:"POST", body:JSON.stringify({query}) }); }
const census = () => Response.json({result:{addressMatches:[{matchedAddress:"17501 NORTHSIDE BLVD, NAMPA, ID",coordinates:{x:-116.573553,y:43.627026}}]}});

it("uses city address points first without calling Census when they match", async () => {
  const fetcher=vi.fn().mockResolvedValue(Response.json({features:[{properties:{SiteAddres:"17501 NORTHSIDE BLVD"},geometry:{type:"Point",coordinates:[-116.573553,43.627026]}}]}));
  vi.stubGlobal("fetch",fetcher);
  const response=await POST(request("17501 Northside Blvd, Nampa, ID"));
  expect((await response.json()).results[0]).toMatchObject({source:"local",label:"17501 NORTHSIDE BLVD, Nampa, ID"});
  expect(fetcher).toHaveBeenCalledOnce();
  expect(String(fetcher.mock.calls[0][0])).toContain("/MapServer/35/query?");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("falls back to Census after the 700ms city timeout and preserves the address in the map URL", async () => {
  const timeout=vi.spyOn(AbortSignal,"timeout").mockImplementation(()=>new AbortController().signal);
  const fetcher=vi.fn().mockRejectedValueOnce(new DOMException("Timeout","TimeoutError")).mockResolvedValueOnce(census());
  vi.stubGlobal("fetch",fetcher);
  const response=await POST(request("17501 Northside Blvd, Nampa, ID"));
  const match=(await response.json()).results[0];
  const url=new URL(locationMapUrl(match.coordinates,match.label)!,"http://localhost");
  expect(url.pathname).toBe("/us/id/map");
  expect(url.searchParams.get("q")).toBe(match.label);
  expect(url.searchParams.get("nearby")).toBe("1");
  expect(timeout.mock.calls[0][0]).toBe(700);
  expect(String(fetcher.mock.calls[1][0])).toContain("benchmark=Public_AR_Current");
});
it("does not misroute another city's matching street through the live city layer", async () => {
  const fetcher=vi.fn().mockResolvedValue(Response.json({result:{addressMatches:[]}}));
  vi.stubGlobal("fetch",fetcher);
  await POST(request("150 N Capitol Blvd, Boise, ID"));
  expect(fetcher).toHaveBeenCalledOnce();
  expect(String(fetcher.mock.calls[0][0])).toContain("geocoding.geo.census.gov");
});
it("supports city-only input using the official Census place layer", async () => {
  const fetcher=vi.fn().mockResolvedValue(Response.json({features:[{attributes:{NAME:"Nampa city",STATE:"16",INTPTLAT:"43.58",INTPTLON:"-116.56"}}]}));
  vi.stubGlobal("fetch",fetcher);
  const r=await POST(request("Nampa, ID"));
  expect((await r.json()).results).toHaveLength(1);
  expect(String(fetcher.mock.calls[0][0])).toContain("Places_CouSub_ConCity_SubMCD/MapServer/4/query");
});
