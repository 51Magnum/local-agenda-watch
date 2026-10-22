import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { HearingFeed } from "@/lib/localities/types";

// Exercise the real feed composition without Next's persistent cache in unit tests.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/locality", () => ({
  getLocalityContext: async () => ({ onSubdomain: false, subdomainSlug: null }),
  localityHref: (slug: string, path: string) => "/" + slug + path,
}));

import { nampa } from "@/lib/localities/nampa";
import Home from "./page";
import NampaHub from "./nampa/page";
import PlanPage from "./nampa/plan/[planNumber]/page";
import { getUpcomingMeetings } from "@/lib/localities/meetings";

const feed: HearingFeed = {
  active: [], completed: [], scheduleUnavailable: false,
  refreshedAt: "2026-10-22T18:00:00.000Z",
};

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Nampa page", () => {
  it("shows a visible failure when both schedule hosts fail, preserving application data", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("arcgis.com")
      ? Response.json({ features: [] })
      : new Response("Forbidden", { status: 403 })));
    const result = await nampa.getHearings!();
    expect(result.scheduleUnavailable).toBe(true);
    expect(result.refreshedAt).toBeDefined();
    vi.spyOn(nampa, "getHearings").mockResolvedValue(result);
    const html = renderToStaticMarkup(await NampaHub());
    expect(html).toContain("Meeting schedule temporarily unavailable");
    expect(html).toContain("Application data only");
    expect(html).toContain("https://www.cityofnampa.us/1433/Upcoming-Public-Hearings");
  });

  it("renders the snapshot time in Denver and links both Braeburn Creek cases", async () => {
    vi.spyOn(nampa, "getHearings").mockResolvedValue(feed);
    const html = renderToStaticMarkup(await NampaHub());
    expect(html).toContain('dateTime="2026-10-22T18:00:00.000Z"');
    expect(html).toContain("12:00 PM");
    expect(html).toContain("America/Denver");
    expect(html).toContain("Braeburn Creek");
    expect(html).toContain("City Council November 2, 2026");
    expect(html).toContain('href="/nampa/plan/ANN-00371-2026"');
    expect(html).toContain('href="/nampa/plan/SPP-00184-2026"');
    expect(html).not.toContain("Meeting schedule temporarily unavailable");
  });
});

describe("homepage count", () => {
  it("renders a count from current case data rather than the old hardcoded value", async () => {
    vi.spyOn(nampa, "getHearings").mockResolvedValue(feed);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("2 items tracked");
    expect(html).not.toContain("1 item tracked");
  });

  it("avoids displaying a misleading count if the application feed fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(nampa, "getHearings").mockRejectedValue(new Error("GIS unavailable"));
    expect(renderToStaticMarkup(await Home())).toContain("View tracked cases");
  });
});


describe("PrimeGov integration", () => {
  const civicHtml = '<h2>Upcoming Public Hearings</h2><h3>November 2, 2026 - City Council</h3><ul><li>Braeburn Creek (<a href="https://example.com">ANN-00371-2026</a>)</li></ul>';
  const primeMeeting = { id: 1, committeeId: 1, title: "City Council - Regular Meeting", dateTime: "2026-11-02T18:00:00", time: "06:00 PM",
    documentList: [{ id: 20, templateId: 12, compileOutputType: 3, templateName: "HTML Agenda", link: null }] };
  const agendaHtml = '<table><tr><td class="agenda-item" id="AgendaItem_1"><p>Braeburn Creek ANN-00371-2026, SPP-00184-2026</p><div class="item_contents"><div class="attachment-holder"><a href="/api/compilemeetingattachmenthistory/historyattachment/?historyId=braeburn">Braeburn Staff Report</a></div></div></td></tr></table>';

  it("links agenda cases and their reports, creates missing cases, and merges duplicate meetings", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("arcgis.com")) return Response.json({ features: [] });
      if (url.includes("ListUpcomingMeetings")) return Response.json([primeMeeting,
        { ...primeMeeting, id: 2, committeeId: 4, title: "Arts & Historic Preservation", dateTime: "2026-11-03T18:00:00", documentList: [] }]);
      if (url.includes("primegov.com")) return new Response(agendaHtml);
      return new Response(civicHtml);
    }));
    const result = await nampa.getHearings!();
    const ann = result.upcomingOnly!.find((h) => h.appId === "ANN-00371-2026")!;
    expect(ann.meetings).toHaveLength(1);
    expect(ann.meetings[0].agendaUrl).toContain("#AgendaItem_1");
    expect(result.upcomingOnly!.some((h) => h.appId === "SPP-00184-2026")).toBe(true);
    expect(getUpcomingMeetings(result, { now: new Date("2026-10-22T12:00:00") })).toHaveLength(2);
    vi.spyOn(nampa, "getHearings").mockResolvedValue(result);
    const hub = renderToStaticMarkup(await NampaHub());
    expect(hub).toContain('href="/nampa/plan/ANN-00371-2026"');
    expect(hub).toContain("Arts &amp; Historic Preservation");
    const detail = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: "ANN-00371-2026" }) }));
    expect(detail).toContain('href="https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=12#AgendaItem_1"');
    expect(detail).toContain('href="https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=braeburn"');
  });

  it("keeps the hub and CivicPlus hearings working when PrimeGov fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("arcgis.com")) return Response.json({ features: [] });
      if (url.includes("primegov.com")) throw new Error("PrimeGov offline");
      return new Response(civicHtml);
    }));
    const result = await nampa.getHearings!();
    expect(result.agendaMeetings).toEqual([]);
    expect(result.scheduleUnavailable).toBe(false);
    vi.spyOn(nampa, "getHearings").mockResolvedValue(result);
    const html = renderToStaticMarkup(await NampaHub());
    expect(html).toContain("November 2, 2026");
    expect(html).toContain("Upcoming meetings &amp; public hearings");
    expect(html).not.toContain("Meeting schedule temporarily unavailable");
    expect(log).toHaveBeenCalledWith("[nampa:primegov] Upcoming meetings failed", expect.any(Error));
  });
});


// These tests exercise the real page, metadata, calendar and Next.js redirect contract.
import LegacyTollBrothersPage from "./nampa/toll-brothers-amity-happy-valley/page";
import BraeburnCreekPage, { metadata as projectMetadata } from "./nampa/braeburn-creek/page";
import { ProjectNextStep } from "./components/project-next-step";
import { braeburnCreek, getProjectNextHearing } from "@/lib/projects";
import { GET as calendarGET } from "./nampa/braeburn-creek/hearing.ics/route";

describe("Braeburn Creek project page", () => {
  it("permanently redirects the legacy Toll Brothers URL", async () => {
    await expect(LegacyTollBrothersPage()).rejects.toMatchObject({ digest: expect.stringContaining("/nampa/braeburn-creek;308;") });
  });

  it("shows the grouped project, next step, both case records and original image links", async () => {
    vi.spyOn(nampa, "getHearings").mockResolvedValue(feed);
    const html = renderToStaticMarkup(await BraeburnCreekPage());
    expect(html).toContain("Developer proposal, not yet approved.");
    expect(html).toContain("Monday, November 2, 2026");
    expect(html).toContain("6:00 PM MST (America/Denver)");
    expect(html).toContain("Written-comment deadline (portal)");
    expect(html).toContain("12:00 PM MST");
    expect(html).toContain("ANN-00371-2026");
    expect(html).toContain("SPP-00184-2026");
    expect(html).toContain("/nampa/toll-brothers-site-map.png");
    expect(html).toContain("Share with a neighbor");
    expect((html.match(/historyId=acf18754-7101-48d9-b4ea-f8398342a0fa/g) ?? [])).toHaveLength(2);
    expect(html).toContain("https://www.cityofnampa.us/1616/Public-Comment");
    expect(projectMetadata.openGraph).toMatchObject({ title: braeburnCreek.title, description: braeburnCreek.summary,
      images: [expect.objectContaining({ url: expect.stringContaining("site-map.webp") })] });
  });

  it("shows the unscheduled state without inventing a date or calendar link", () => {
    const hearing = getProjectNextHearing({ ...braeburnCreek, nextHearing: undefined });
    const html = renderToStaticMarkup(createElement(ProjectNextStep, { hearing, calendarHref: "/hearing.ics" }));
    expect(html).toContain("No hearing scheduled yet.");
    expect(html).not.toContain("Add hearing to calendar");
    expect(html).not.toContain("November 2");
  });

  it("serves a calendar download matching the next-step box", async () => {
    vi.spyOn(nampa, "getHearings").mockResolvedValue(feed);
    const response = await calendarGET();
    expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain("braeburn-creek-hearing.ics");
    expect(await response.text()).toContain("DTSTART:20261103T010000Z");
  });
});


import { GET as caseCalendarGET } from "./nampa/plan/[planNumber]/hearing.ics/route";
import type { Hearing } from "@/lib/localities/types";
import type { EnerGovAttachment, EnerGovPlan } from "@/lib/sources/energov";

describe("automatic case next step", () => {
  const logistics: Hearing = {
    appId: "ANN-00369-2026", appType: "ANN", appTypeLabel: "Annexation", appStatus: "Pending", appPhase: "City Council", appPhaseRaw: "City Council",
    appScope: "Nampa Logistics Center", appAcres: 1.69, externalUrl: null, energovPlanId: "bece9867-3585-444b-b9bc-f5702f95b5cc",
    meetings: [{ body: "City Council", bodyLabel: "City Council", date: "2026-11-02", dateLabel: "November 2, 2026", time: "18:00", continuedNote: null, sourceUrl: "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings" }],
  };
  afterEach(() => vi.useRealTimers());
  function setup(record = logistics) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T18:00:00Z"));
    vi.spyOn(nampa, "getHearings").mockResolvedValue({ active: [record], completed: [] });
    vi.spyOn(nampa.energov!, "getPlan").mockResolvedValue({ ProjectName: "Nampa Logistics Center", PlanNumber: record.appId, PlanType: "Annexation", MainAddress: "17501 Northside Blvd", Description: "Annexation to IL" } as EnerGovPlan);
    vi.spyOn(nampa.energov!, "getPlanAttachments").mockResolvedValue([
      { AttachmentID: "site", Notes: "Site plan", FileName: "Site.pdf", IsFileSecure: false },
      { AttachmentID: "staff", Notes: "Staff report", FileName: "Staff.pdf", IsFileSecure: false },
    ] as EnerGovAttachment[]);
  }

  it("shows ANN-00369-2026's Nov 2 next step, pending agenda, comment deadline, and calendar", async () => {
    setup();
    const html = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: logistics.appId }) }));
    expect(html).toContain("Next step");
    expect(html).toContain("Monday, November 2, 2026");
    expect(html).toContain("6:00 PM MST (America/Denver)");
    expect(html).toContain("12:00 PM MST");
    expect(html).toContain("confirm with the published agenda");
    expect(html).toContain("Agenda usually posted the Thursday before the meeting");
    expect(html).toContain('href="/nampa/plan/ANN-00369-2026/hearing.ics"');
    expect(html).toContain("Developer proposal, not yet approved.");
    expect(html).toContain("Nampa Logistics Center: annexation of 1.69 acres at 17501 Northside Blvd to IL (light industrial).");
    expect(html.indexOf("Staff report:")).toBeLessThan(html.indexOf("Site plan"));
    expect(html.indexOf("Documents")).toBeLessThan(html.indexOf("Case status"));
    const response = await caseCalendarGET(new Request("http://localhost/calendar"), { params: Promise.resolve({ planNumber: logistics.appId }) });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("DTSTART:20261103T010000Z");
    expect(renderToStaticMarkup(await NampaHub())).toContain("Agenda usually posted the Thursday before the meeting");
  });

  it("shows official agenda and packet links when published", async () => {
    setup({ ...logistics, meetings: [{ ...logistics.meetings[0], agendaUrl: "https://nampa.primegov.com/agenda", packetUrl: "https://nampa.primegov.com/packet" }] });
    const html = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: logistics.appId }) }));
    expect(html).toContain('href="https://nampa.primegov.com/agenda"');
    expect(html).toContain('href="https://nampa.primegov.com/packet"');
    expect(html).not.toContain("Agenda usually posted the Thursday before the meeting");
  });

  it("does not label a decided case as an unapproved proposal", async () => {
    setup({ ...logistics, decisionRecorded: true });
    const html = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: logistics.appId }) }));
    expect(html).not.toContain("Developer proposal, not yet approved.");
    expect(html).toContain("No hearing scheduled yet.");
  });
});
