import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/locality", () => ({ getLocalityContext: async () => ({}), localityHref: (_slug: string, path: string) => "/nampa" + path }));
vi.mock("@/lib/sources/primegov", () => ({ getNampaMeetingArchive: vi.fn() }));
import { getNampaMeetingArchive } from "@/lib/sources/primegov";
import Page from "./page";
import { nampa } from "@/lib/localities/nampa";
import type { Hearing } from "@/lib/localities/types";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T18:00:00Z")); vi.spyOn(nampa, "getHearings").mockResolvedValue({ active: [], completed: [] }); });
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); vi.useRealTimers(); });
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

it("retains case and year when switching hearing tabs and includes the next Council hearing", async () => {
  vi.mocked(getNampaMeetingArchive).mockResolvedValue({ unavailable: false, unsearched: 0, meetings: [] });
  vi.mocked(nampa.getHearings!).mockResolvedValue({ completed: [], active: [{ appId: "ANN-00369-2026", appTypeLabel: "Annexation", appStatus: "Pending", appPhase: "City Council", appPhaseRaw: "City Council", meetings: [{ body: "City Council", bodyLabel: "City Council", date: "2026-11-02", dateLabel: "November 2, 2026", time: "18:00", continuedNote: null, sourceUrl: "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings" }] } as Hearing] });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ case: "ANN-00369-2026", body: "City Council", year: "2026" }) }));
  expect(html).toContain("Current status: Council hearing");
  expect(html).toContain("Viewing: Council hearing records");
  expect(html).toContain('href="/nampa/meetings?case=ANN-00369-2026&amp;year=2026&amp;body=P%26Z"');
  expect(html).toContain('href="/nampa/plan/ANN-00369-2026#case-documents"');
  expect(html).toContain('aria-current="page"');
  expect(html).toContain("November 2, 2026");
});
