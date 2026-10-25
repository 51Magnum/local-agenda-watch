import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/maps/store", () => ({
  exportFlumPage: vi.fn().mockResolvedValue({ features: [], legend: [] }),
}));
import { GET } from "./route";
import { exportFlumPage } from "@/lib/maps/store";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("never reads the database for an unauthenticated export", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect(
    (await GET(new Request("https://test/api/cron/flum-export?area=nampa")))
      .status,
  ).toBe(401);
  expect(exportFlumPage).not.toHaveBeenCalled();
});
it("validates the requested area and page before reading an authenticated export", async () => {
  vi.stubEnv("CRON_SECRET", "test-export-long-credential");
  const headers = { authorization: "Bearer test-export-long-credential" };
  for (const q of [
    "area=unknown",
    "area=nampa&offset=-1",
    "area=nampa&offset=Infinity",
  ]) {
    expect(
      (
        await GET(
          new Request("https://test/api/cron/flum-export?" + q, { headers }),
        )
      ).status,
    ).toBe(400);
  }
  expect(exportFlumPage).not.toHaveBeenCalled();
  const r = await GET(
    new Request("https://test/api/cron/flum-export?area=nampa&offset=250", {
      headers,
    }),
  );
  expect(r.status).toBe(200);
  expect(exportFlumPage).toHaveBeenCalledWith("nampa", 250);
  expect(r.headers.get("Cache-Control")).toBe("no-store");
});
