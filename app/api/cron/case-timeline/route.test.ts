import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { POST } from "@/app/admin/review/action/route";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";
afterEach(() => vi.unstubAllEnvs());
it("rejects unauthenticated cron invocations even when configuration is absent", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(new Request("http://localhost/api/cron/case-timeline"))).status).toBe(401);
});
it("reports a missing extraction key without starting a job", async () => {
  vi.stubEnv("CRON_SECRET", "test-cron-secret"); vi.stubEnv("OPENAI_API_KEY", "");
  const response = await GET(new Request("http://localhost/api/cron/case-timeline?manual=1&force=1", { headers: { authorization: "Bearer test-cron-secret" } }));
  expect(response.status).toBe(503);
});
it("protects all review pages and actions and fails closed without configuration", () => {
  vi.stubEnv("REVIEW_ADMIN_PASSWORD", "");
  expect(proxy(new NextRequest("http://localhost/admin/review"))?.status).toBe(503);
  vi.stubEnv("REVIEW_ADMIN_PASSWORD", "test-admin-password");
  const response = proxy(new NextRequest("http://localhost/admin/review"));
  expect(response?.status).toBe(401);
  expect(response?.headers.get("WWW-Authenticate")).toContain("Basic");
  const authorized = proxy(new NextRequest("http://localhost/admin/review", { headers: { authorization: "Basic " + Buffer.from("admin:test-admin-password").toString("base64") } }));
  expect(authorized?.headers.get("Cache-Control")).toBe("private, no-store");
});
it("rejects cross-site review mutations even with valid authentication", async () => {
  vi.stubEnv("REVIEW_ADMIN_PASSWORD", "test-admin-password");
  const response = await POST(new Request("http://localhost/admin/review/action", { method: "POST", headers: { authorization: "Basic " + Buffer.from("admin:test-admin-password").toString("base64"), origin: "https://other.example" } }));
  expect(response.status).toBe(403);
});
