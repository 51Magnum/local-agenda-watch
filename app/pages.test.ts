vi.mock("@/lib/localities/municipal",()=>({MUNICIPAL_LOCALITIES:Object.fromEntries(["kuna","star","middleton","eagle"].map(id=>[id,{slug:id,tracked:[],getHearings:async()=>({active:[],completed:[]})}])),MUNICIPAL_FEEDS:Object.fromEntries(["kuna","star","middleton","eagle"].map(id=>[id,async()=>({active:[],completed:[]})]))}));
import * as mapStore from "@/lib/maps/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { HearingFeed } from "@/lib/localities/types";

// Page tests must not depend on the developer's private evidence store.
vi.mock("@/lib/timeline/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/timeline/public")>();
  return { ...actual, readTimelineState: async () => ({ version: 1, documents: {}, fields: {}, audit: [], runs: [], leases: {} }) };
});

// Exercise the real feed composition without Next's persistent cache in unit tests.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/locality", () => ({
  getLocalityContext: async () => ({ onSubdomain: false, subdomainSlug: null }),
  localityHref: (slug: string, path: string) => "/us/id/" + slug + path,
}));

import { nampa } from "@/lib/localities/nampa";
vi.mock("@/lib/localities/meridian",()=>({meridian:{slug:"meridian",tracked:[],getHearings:async()=>({active:[],completed:[]})},getMeridianHearings:async()=>({active:[],completed:[]})}));
vi.mock("@/lib/localities/canyon-county",()=>({canyonCounty:{slug:"canyon-county",tracked:[],getHearings:async()=>({active:[],completed:[]})},getCanyonCountyHearings:async()=>({active:[],completed:[]})}));
import Home from "./page";
import NampaHub from "./nampa/page";
import PlanPage, { generateMetadata as caseMetadata } from "./nampa/plan/[planNumber]/page";
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
    expect(html).toContain('href="/us/id/nampa/plan/ANN-00371-2026"');
    expect(html).toContain('href="/us/id/nampa/plan/SPP-00184-2026"');
    expect(html).not.toContain("Meeting schedule temporarily unavailable");
  });
});

describe("map-first homepage", () => {
  it("renders the map shell without fetching every locality feed", async () => {
    const source=vi.spyOn(nampa, "getHearings").mockResolvedValue(feed);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("Development projects map");
    expect(source).not.toHaveBeenCalled();
  });

  it("avoids displaying a misleading count if the application feed fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(nampa, "getHearings").mockRejectedValue(new Error("GIS unavailable"));
    expect(renderToStaticMarkup(await Home())).toContain("Development projects map");
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
    expect(hub).toContain('href="/us/id/nampa/plan/ANN-00371-2026"');
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
    await expect(LegacyTollBrothersPage()).rejects.toMatchObject({ digest: expect.stringContaining("/us/id/nampa/braeburn-creek;308;") });
  });

  it("shows the grouped project, next step, both case records and original image links", async () => {
    vi.spyOn(nampa, "getHearings").mockResolvedValue(feed);
    vi.spyOn(nampa.energov!, "getPlan").mockResolvedValue(null);
    vi.spyOn(nampa.energov!, "getPlanAttachments").mockResolvedValue([]);
    vi.spyOn(mapStore,"readMapSnapshot").mockResolvedValue({version:1,jurisdiction:"nampa",updatedAt:"2026-10-23",warnings:[],cases:[{id:"ANN-00371-2026",title:"Braeburn",summary:"",type:"ANN",typeLabel:"Annexation",stage:"Council/Board",href:"/us/id/nampa/braeburn-creek",geometry:null,centroid:null,source:"none",confidence:"approximate",citywide:false,flumCategories:["Medium Density Residential"]}]});
    const html = renderToStaticMarkup(await BraeburnCreekPage());
    expect(html).toContain("Developer proposal, not yet approved.");
    expect(html).toContain("Monday, November 2, 2026");
    expect(html).toContain("6:00 PM MST (America/Denver)");
    expect(html).toContain("Written-comment deadline (portal)");
    expect(html).toContain("12:00 PM MST");
    expect(html).toContain("ANN-00371-2026");
    expect(html).toContain("SPP-00184-2026");
    expect(html).not.toContain("/us/id/nampa/toll-brothers-site-map.png");
    expect(html).toContain("Share with a neighbor");
    expect((html.match(/>Staff report · September 29, 2026 P&amp;Z hearing<\/a>/g) ?? [])).toHaveLength(1);
    expect((html.match(/>P&amp;Z decision letter<\/a>/g) ?? [])).toHaveLength(1);
    expect(html).toContain("~3.5 homes/acre");
    expect(html).toContain("Medium Density Residential");
    expect(html).toContain("Met Sep 29, 2026, result pending");
    const proposed = html.split('aria-labelledby="whats-proposed-title"')[1]?.split("</section>")[0] ?? "";
    expect(proposed).not.toMatch(/Krajnick|Brandi|R3066|Section 30|T3N|R1W|parcel/i);
    expect(html).not.toContain("Where this is");
    expect(html).not.toContain("Main conditions");
    expect(html).toContain("https://www.cityofnampa.us/1616/Public-Comment");
    expect(projectMetadata.openGraph).toMatchObject({ title: braeburnCreek.title, description: braeburnCreek.summary,
      images: [expect.objectContaining({ url: expect.stringContaining("opengraph-image") })] });
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
    expect(html).toContain('href="/us/id/nampa/plan/ANN-00369-2026/hearing.ics"');
    expect(html).toContain("Developer proposal, not yet approved.");
    expect(html).toContain("Northside Logistics Center: annexation of 1.69 acres at 17501 Northside Blvd to IL (light industrial).");
    expect(html.indexOf("Staff report ·")).toBeLessThan(html.indexOf("Site plan"));
    expect(html).toContain("Key documents");
    expect(html).not.toContain("Case status");
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
    expect(html).not.toContain('id="next-step-title"');
  });
});


import sitemap from "./sitemap";
import robots from "./robots";
import ContactPage from "./contact/page";

describe("case parity, hub cleanup and SEO", () => {
  const record: Hearing = {
    appId: "ANN-00369-2026", appType: "ANN", appTypeLabel: "Annexation", appStatus: "Pending", appPhase: "City Council", appPhaseRaw: "City Council",
    appScope: "Annexaation to IL", appAcres: 1.69, externalUrl: null, energovPlanId: "bece9867-3585-444b-b9bc-f5702f95b5cc",
    meetings: [{ body: "City Council", bodyLabel: "City Council", date: "2026-11-02", dateLabel: "November 2, 2026", time: "18:00", continuedNote: null, sourceUrl: "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings" }],
  };
  afterEach(() => vi.useRealTimers());
  function setup(active: Hearing[] = [record], completed: Hearing[] = []) {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T18:00:00Z"));
    vi.spyOn(nampa, "getHearings").mockResolvedValue({ active, completed });
    vi.spyOn(nampa.energov!, "getPlan").mockResolvedValue({ PlanType: "Annexation (more than 1 acre)", MainAddress: "17501 Northside Blvd, Nampa, ID 83687", PlanNumber: record.appId } as EnerGovPlan);
    vi.spyOn(nampa.energov!, "getPlanAttachments").mockResolvedValue([
      { AttachmentID: "1", FileName: "ANN-00369-2026_Northside Logistics Center_Application.pdf", IsFileSecure: false },
      { AttachmentID: "2", FileName: "Site plan.pdf", IsFileSecure: false },
      { AttachmentID: "3", FileName: "Site plan.pdf", IsFileSecure: false },
    ] as EnerGovAttachment[]);
  }

  it("shows the exact sourced summary, shared controls, case metadata and original title", async () => {
    setup();
    const html = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: record.appId }) }));
    const summary = "Northside Logistics Center: annexation of 1.69 acres at 17501 Northside Blvd, Nampa, ID 83687 to IL (light industrial).";
    expect(html).toContain(summary);
    expect(html).toContain("Share with a neighbor");
    expect(html).toMatch(/aria-current="step"[^>]*>[\s\S]*?Council hearing/);
    expect(html.indexOf("Share with a neighbor")).toBeLessThan(html.indexOf("Next step"));
    expect(html).toContain("Project timeline");
    expect(html).toContain("Official title:</span> Annexaation to IL");
    expect(html).toContain(">Northside Logistics Center</h1>");
    expect((html.match(/>Site plan.pdf</g) ?? [])).toHaveLength(1);
    const meta = await caseMetadata({ params: Promise.resolve({ planNumber: record.appId }) });
    expect(meta.description).toContain("Northside Logistics Center annexation. Council hearing. Next hearing:");
    expect(meta.alternates?.canonical).toBe("https://www.localagendawatch.com/us/id/nampa/plan/ANN-00369-2026");
    expect(meta.openGraph).toMatchObject({ title: "Northside Logistics Center annexation (ANN-00369-2026)", description: meta.description });
  });

  it("uses the zoning-only project template for Northside without inventing housing or buildings", async () => {
    setup();
    const html = renderToStaticMarkup(await PlanPage({params:Promise.resolve({planNumber:record.appId})}));
    const facts=html.split('aria-label="Key project facts"')[1]?.split("</section>")[0]??"";
    expect(facts).toContain("1.69");expect(facts).toContain("IL (Light Industrial)");expect(facts).not.toContain("HOMES / LOTS");expect(facts).not.toContain("homes/acre");expect(facts).not.toContain("Building area");
    expect(html).toContain("rather than approval of a specific building");expect(html).toContain("Council hearing · Nov 2, 2026");expect(html).not.toContain("Council hearing · Nov 3");
    expect((html.match(/>Site plan.pdf</g)??[])).toHaveLength(1);
    expect(html).not.toContain("<h3 class=\"font-semibold\">Schools");
  });

  it("CUP-00411-2026 highlights Decided and hides Next step", async () => {
    const decided = { ...record, appId: "CUP-00411-2026", appStatus: "Approved", appPhase: "PZ Commission" as const, meetings: [] };
    setup([], [decided]);
    const html = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: decided.appId }) }));
    expect(html).toMatch(/aria-current="step"[^>]*>[\s\S]*?<h3[^>]*>Decided/);
    expect(html).not.toContain('id="next-step-title"');
    expect(html).not.toContain("Developer proposal, not yet approved.");
  });

  it("uses the project image while preserving a case's own title and canonical URL", async () => {
    setup([{ ...record, appId: "ANN-00371-2026", appScope: "Braeburn annexation" }]);
    const meta = await caseMetadata({ params: Promise.resolve({ planNumber: "ANN-00371-2026" }) });
    expect(meta.openGraph).toMatchObject({ title: "Braeburn Creek annexation (ANN-00371-2026)", images: ["https://www.localagendawatch.com/us/id/nampa/opengraph-image"] });
  });

  it("hides irrelevant zero-case meetings, groups descriptions, and explains missing Council dates", async () => {
    const shared = { ...record, appId: "ANN-00001-2026", appScope: "Identical proposal text", meetings: [{ ...record.meetings[0], body: "P&Z", bodyLabel: "Planning & Zoning Commission", date: "2026-09-29", dateLabel: "September 29, 2026" }] };
    setup([shared, { ...shared, appId: "SPP-00001-2026" }]);
    vi.mocked(nampa.getHearings!).mockResolvedValue({ active: [shared, { ...shared, appId: "SPP-00001-2026" }], completed: [], agendaMeetings: [{ id: "1", body: "City Council", bodyLabel: "City Council", title: "State of the City", date: "2026-10-22", dateLabel: "October 22, 2026", sourceUrl: "https://nampa.primegov.com", items: [] }] });
    const html = renderToStaticMarkup(await NampaHub());
    expect(html).not.toContain("State of the City");
    expect(html).toContain("Council date not set");
    expect(html).not.toContain("September 29, 2026");
    expect((html.match(/>Identical proposal text annexation</g) ?? [])).toHaveLength(1);
    expect(html).toContain("ANN-00001-2026"); expect(html).toContain("SPP-00001-2026");
  });

  it("sitemap lists every project and active, completed and upcoming-only case", async () => {
    setup();
    vi.mocked(nampa.getHearings!).mockResolvedValue({ active: [record], completed: [{ ...record, appId: "CUP-00411-2026" }], upcomingOnly: [{ ...record, appId: "SPP-12345-2026" }] });
    const urls = (await sitemap()).map((e) => e.url);
    for (const path of ["/", "/us/id/nampa", "/us/id/nampa/braeburn-creek", "/us/id/nampa/plan/ANN-00369-2026", "/us/id/nampa/plan/CUP-00411-2026", "/us/id/nampa/plan/SPP-12345-2026", "/us/id/nampa/plan/ANN-00371-2026", "/us/id/nampa/plan/SPP-00184-2026"]) expect(urls).toContain("https://www.localagendawatch.com" + path);
    expect(new Set(urls).size).toBe(urls.length);
    expect(robots().sitemap).toBe("https://www.localagendawatch.com/sitemap.xml");
  });

  it("Contact uses the configured placeholder with no personal email or GitHub link", () => {
    const html = renderToStaticMarkup(createElement(ContactPage));
    expect(html).toContain("Contact details coming soon.");
    expect(html).not.toContain("mailto:"); expect(html).not.toContain("github.com");
  });
});


describe("stage navigation on the Nampa overview", () => {
  it("filters to the selected stage, opens its cases, and retains all stage links", async () => {
    const base = { appId: "ANN-12345-2026", appType: "ANN", appTypeLabel: "Annexation", appStatus: "Pending", appPhaseRaw: "", appScope: "Council case", appAcres: 1, externalUrl: null, energovPlanId: null, meetings: [] };
    vi.spyOn(nampa, "getHearings").mockResolvedValue({ active: [
      { ...base, appPhase: "City Council" } as Hearing,
      { ...base, appId: "ANN-12346-2026", appPhase: "Review", appScope: "Review case" } as Hearing,
    ], completed: [] });
    const html = renderToStaticMarkup(await NampaHub({ searchParams: Promise.resolve({ stage: "Council hearing" }) }));
    expect(html).toContain("Council case");
    expect(html).not.toContain("Review case");
    expect(html).toContain('<details open=""');
    expect(html).toMatch(/href="\/us\/id\/nampa\/?\?stage=Under%20review"/);
    expect(html).toContain('aria-current="page"');
  });
});


describe("site-review regressions", () => {
  afterEach(() => vi.useRealTimers());
  const record = (id: string, overrides: Partial<Hearing> = {}): Hearing => ({
    appId: id, appType: id.split("-")[0], appTypeLabel: "Annexation", appStatus: "Pending", appPhase: "Other", appPhaseRaw: "", appScope: "A long official city description which must remain source text only.", appAcres: null, externalUrl: null, energovPlanId: null, meetings: [], ...overrides,
  });
  const decision = (id: string, result: string) => record(id, { meetings: [
    { body: "City Council", bodyLabel: "City Council", date: "2026-09-21", dateLabel: "September 21, 2026", continuedNote: "Continued to October 19", sourceUrl: "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings" },
    { body: "City Council", bodyLabel: "City Council", date: "2026-10-19", dateLabel: "October 19, 2026", continuedNote: null, result, sourceUrl: "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings" },
  ] });
  it("a Council decision overrides Submitted, stale continuances and upcoming hearings", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T18:00:00Z"));
    for (const [id, result] of [["ANN-00358-2026", "Denied"], ["MPC-00006-2026", "Denied"], ["SPP-00182-2026", "Approved"]]) {
      vi.spyOn(nampa, "getHearings").mockResolvedValue({ active: [], completed: [], upcomingOnly: [decision(id, result)] });
      const html = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: id }) }));
      expect(html).toContain("Decided (" + result + ")");
      expect(html).toMatch(/aria-current="step"[^>]*>[\s\S]*?<h3[^>]*>Decided/);
      expect(html).not.toContain(">Continued<"); expect(html).not.toContain("Continued to October 19");
      expect(html).not.toContain('id="next-step-title"');
      expect(html).not.toContain("Developer proposal, not yet approved.");
      const meta = await caseMetadata({ params: Promise.resolve({ planNumber: id }) });
      expect(meta.description).toContain("Decided (" + result + ")");
      expect(meta.title).not.toContain("A long official");
    }
  });
  it("lists all sitemap cases, including more than ten completed cases, with one shared count", async () => {
    const completed = Array.from({ length: 12 }, (_, i) => record("CUP-" + String(i).padStart(5, "0") + "-2025", { decisionRecorded: true }));
    completed.push(record("ANN-00339-2025", { decisionRecorded: true }));
    const data = { active: [], completed, upcomingOnly: [decision("ANN-00358-2026", "Denied"), decision("MPC-00006-2026", "Denied"), decision("SPP-00182-2026", "Approved")] };
    vi.spyOn(nampa, "getHearings").mockResolvedValue(data);
    const hub = renderToStaticMarkup(await NampaHub());
    const home = renderToStaticMarkup(await Home());
    expect(hub).toContain("Recently decided");
    expect(hub).toContain("(18)"); expect(home).toContain("Development projects map");
    for (const url of (await sitemap()).map((e) => e.url).filter((u) => u.includes("/plan/"))) expect(hub).toContain('href="' + new URL(url).pathname + '"');
  });
  it("shows missing Council dates and stale unlinked Wilson Landing honestly", async () => {
    vi.spyOn(nampa, "getHearings").mockResolvedValue({ active: [record("ANN-00370-2026", { appPhase: "City Council" }), record("SPP-00124-2023", { appPhase: "PZ Commission", appScope: "Wilson Landing" })], completed: [] });
    const council = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: "ANN-00370-2026" }) }));
    expect(council).toContain("Council date not set");
    const wilson = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: "SPP-00124-2023" }) }));
    expect(wilson).toContain("Status unclear, no recent city record");
    expect(wilson).not.toContain('aria-current="step"');
    const hub = renderToStaticMarkup(await NampaHub());
    expect(hub).toContain("Status unclear, no recent city record");
  });
  it("hides neighborhood attendance sheets and retains the city-name clarification", async () => {
    const hearing = record("ANN-00369-2026", { energovPlanId: "fixture", appPhase: "City Council" });
    vi.spyOn(nampa, "getHearings").mockResolvedValue({ active: [hearing], completed: [] });
    vi.spyOn(nampa.energov!, "getPlan").mockResolvedValue(null);
    vi.spyOn(nampa.energov!, "getPlanAttachments").mockResolvedValue([
      { AttachmentID: "private", FileName: "Neighborhood Meeting Sign In Sheet.pdf", Notes: "Neighborhood Mtg Sign-In Sheet", IsFileSecure: false },
      { AttachmentID: "public", FileName: "Site Plan.pdf", IsFileSecure: false },
    ] as EnerGovAttachment[]);
    const html = renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ planNumber: hearing.appId }) }));
    expect(html).not.toContain("Sign In Sheet"); expect(html).not.toContain("Sign-In Sheet");
    expect(html).toContain("Site Plan.pdf");
    expect(html).toContain("(listed by the city as Nampa Logistics Center)");
  });
});

it("replaces editorial watching with personal watches and keeps the full catalog collapsed by default", async () => {
  vi.spyOn(nampa, "getHearings").mockResolvedValue(feed);
  const html = renderToStaticMarkup(await NampaHub());
  expect(html).toContain("You are watching"); expect(html).toContain("Saved in this browser");
  expect(html).not.toContain("We’re watching");
  expect(html).toMatch(/<details id="all-cases" class=/);
  expect(html).not.toMatch(/<details id="all-cases" open/);
  expect(html).toContain("Project guides");
});

it("uses canonical area and map URLs in the sitemap", async () => {
  vi.spyOn(nampa,"getHearings").mockResolvedValue(feed);
  const html=renderToStaticMarkup(await NampaHub());
  expect(html).toContain("What’s coming to Nampa, Idaho"); expect(html).toContain("law-map-full");
  expect(html).not.toContain("bg-slate-900 text-white"); expect(html).not.toContain("Open map →");
  expect(html).toContain('href="#you-are-watching-title"');
  const urls=(await sitemap()).map((entry)=>entry.url);
  expect(urls).toContain("https://www.localagendawatch.com/us/id/nampa");
  expect(urls).toContain("https://www.localagendawatch.com/us/id/nampa/map");
});


it("uses the shared template for citywide amendments without a project map or site metrics", async () => {
  const amendment = { appId:"ZTA-00050-2026", appType:"ZTA", appTypeLabel:"Zoning code text amendment", appStatus:"Pending", appPhase:"Review" as const, appPhaseRaw:"Review", appScope:"Group homes and GB district", appAcres:30, externalUrl:null, energovPlanId:null, meetings:[] };
  vi.spyOn(nampa,"getHearings").mockResolvedValue({active:[amendment],completed:[]});
  const html=renderToStaticMarkup(await PlanPage({params:Promise.resolve({planNumber:amendment.appId})}));
  expect(html).toContain("Citywide · Nampa, Idaho");expect(html).toContain("What’s proposed");expect(html).toContain("All city files");
  expect(html).not.toContain('id="case-location-map"');expect(html).not.toContain("homes/acre");expect(html).not.toContain("Site acres");
});
it("groups verified related cases and deduplicates their shared key documents", async () => {
  const base = { appType:"ANN",appTypeLabel:"Annexation",appStatus:"Pending",appPhase:"City Council" as const,appPhaseRaw:"City Council",appScope:"Lonestar",appAcres:10,externalUrl:null,energovPlanId:null,meetings:[{body:"P&Z",bodyLabel:"Planning & Zoning",date:"2026-09-29",dateLabel:"September 29, 2026",continuedNote:null,sourceUrl:"https://city.test/agenda",staffReports:[{label:"Shared staff report",url:"https://city.test/report.pdf"}]}] };
  vi.spyOn(nampa,"getHearings").mockResolvedValue({active:[{...base,appId:"ANN-00358-2026"},{...base,appId:"MPC-00006-2026",appType:"MPC",appTypeLabel:"Master planned community"}],completed:[]});
  const html=renderToStaticMarkup(await PlanPage({params:Promise.resolve({planNumber:"ANN-00358-2026"})}));
  expect(html).toContain("2 related cases");expect(html).toContain("MPC-00006-2026");
  expect((html.match(/>Shared staff report<\/a>/g)??[])).toHaveLength(1);
  expect((html.match(/Met Sep 29, 2026/g)??[])).toHaveLength(1);
  expect(html).not.toContain(">Traffic<");expect(html).not.toContain(">Schools<");
});

it("keeps stage links anchored and offers working meeting packets when the city file portal fails", async () => {
  const hearing={appId:"SPP-00183-2026",appType:"SPP",appTypeLabel:"Preliminary plat",appStatus:"Pending",appPhase:"City Council" as const,appPhaseRaw:"City Council",appScope:"Resting Rock",appAcres:36.65,externalUrl:null,energovPlanId:"fixture",meetings:[]};
  vi.spyOn(nampa,"getHearings").mockResolvedValue({active:[hearing],completed:[]});
  vi.spyOn(nampa.energov!,"getPlan").mockResolvedValue(null);
  vi.spyOn(nampa.energov!,"getPlanAttachments").mockRejectedValue(new Error("403"));
  vi.spyOn(console,"error").mockImplementation(()=>{});
  vi.spyOn(mapStore,"readMapSnapshot").mockResolvedValue({cases:[{id:hearing.appId,flumCategories:[],visual:{documentTitle:"Resting Rock Staff Report PZ",sourceUrl:"https://nampa.primegov.com/report.pdf#page=4"}}]} as never);
  const html=renderToStaticMarkup(await PlanPage({params:Promise.resolve({planNumber:hearing.appId})}));
  expect(html).toContain('id="case-status"');expect(html).toContain("Browse meeting packets and staff reports instead");expect(html).toContain('href="/us/id/nampa/meetings?case=SPP-00183-2026"');expect(html).toContain('href="https://nampa.primegov.com/report.pdf#page=4"');
});
