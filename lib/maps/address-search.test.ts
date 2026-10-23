import { afterEach, expect, it, vi } from "vitest";
import { searchAddress } from "./address-search";
import { JURISDICTIONS } from "./jurisdictions";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("falls back promptly after a local timeout and reuses the cached Census result", async () => {
  const storage = new Map<string,string>();
  vi.stubGlobal("sessionStorage", { getItem: (key:string) => storage.get(key) ?? null, setItem: (key:string,value:string) => storage.set(key,value), removeItem: (key:string) => storage.delete(key) });
  const timeout = vi.spyOn(AbortSignal,"timeout").mockImplementation(() => new AbortController().signal);
  const result = {label:"17501 NORTHSIDE BLVD",coordinates:[-116.56,43.61],source:"Census"};
  const fetcher = vi.fn().mockRejectedValueOnce(new DOMException("Timed out","TimeoutError")).mockResolvedValueOnce(Response.json({results:[result]}));
  vi.stubGlobal("fetch",fetcher);
  expect(await searchAddress(JURISDICTIONS.nampa,"17501 Northside Blvd")).toEqual([result]);
  expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([900,8000]);
  expect(String(fetcher.mock.calls[0][0])).toContain("/query?");
  expect(fetcher.mock.calls[1][0]).toBe("/api/maps/geocode");
  expect(fetcher.mock.calls[1][1]).toMatchObject({method:"POST",cache:"no-store"});
  expect(await searchAddress(JURISDICTIONS.nampa,"17501 Northside Blvd")).toEqual([result]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
