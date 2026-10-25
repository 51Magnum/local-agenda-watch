import { expect, it, vi, afterEach } from "vitest";
vi.mock("@/lib/maps/case-index", () => ({
  exportMapFeatures: vi.fn().mockResolvedValue({ features: [] }),
}));
import { GET } from "./route";
afterEach(() => vi.unstubAllEnvs());
it("keeps optional export closed without the configured cron credential", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect(
    (await GET(new Request("https://example.test/api/cron/map-export"))).status,
  ).toBe(401);
});
it("only serves the public export to an authenticated runner and rejects malformed cursors", async () => {
  vi.stubEnv("CRON_SECRET", "test-export-credential-long-enough");
  const headers = {
    authorization: "Bearer test-export-credential-long-enough",
  };
  expect(
    (
      await GET(
        new Request("https://example.test/api/cron/map-export?cursor=bad", {
          headers,
        }),
      )
    ).status,
  ).toBe(400);
  const r = await GET(
    new Request("https://example.test/api/cron/map-export", { headers }),
  );
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ features: [] });
  expect(r.headers.get("Cache-Control")).toBe("no-store");
});
