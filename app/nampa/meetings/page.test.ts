import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/locality", () => ({ getLocalityContext: async () => ({}), localityHref: (_slug: string, path: string) => "/nampa" + path }));
vi.mock("@/lib/sources/primegov", () => ({ getNampaMeetingArchive: vi.fn() }));
import { getNampaMeetingArchive } from "@/lib/sources/primegov";
import Page from "./page";
afterEach(() => vi.resetAllMocks());
it("preserves the case/body filter and shows missing results explicitly", async () => {
  vi.mocked(getNampaMeetingArchive).mockResolvedValue({ unavailable: false, unsearched: 2, meetings: [{ id: "1", body: "P&Z", bodyLabel: "P&Z", title: "Regular Meeting", date: "2026-09-29", dateLabel: "September 29, 2026", sourceUrl: "https://nampa.primegov.com/public/portal", agendaUrl: "https://nampa.primegov.com/agenda", items: [] }] });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ case: "ANN-00369-2026", body: "P&Z" }) }));
  expect(getNampaMeetingArchive).toHaveBeenCalledWith(2026, { caseId: "ANN-00369-2026", body: "P&Z" });
  expect(html).toContain("Official agenda");
  expect(html).toContain("no minutes link is published");
  expect(html).toContain("history may be incomplete");
});
it("links minutes when the city publishes them", async () => {
  vi.mocked(getNampaMeetingArchive).mockResolvedValue({ unavailable: false, unsearched: 0, meetings: [{ id: "1", body: "City Council", bodyLabel: "City Council", title: "Regular Meeting", date: "2026-01-05", dateLabel: "January 5, 2026", sourceUrl: "https://nampa.primegov.com/public/portal", minutesUrl: "https://nampa.primegov.com/minutes", items: [] }] });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('href="https://nampa.primegov.com/minutes"');
  expect(html).not.toContain("Result not yet available here");
});
it("keeps the official archive accessible during an outage", async () => {
  vi.mocked(getNampaMeetingArchive).mockResolvedValue({ unavailable: true, unsearched: 0, meetings: [] });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("Meeting archive temporarily unavailable");
  expect(html).toContain("Open the official archive");
});
