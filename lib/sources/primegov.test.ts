import { afterEach, describe, expect, it, vi } from "vitest";
import { getNampaPrimeGovMeetings, NAMPA_PRIMEGOV_MEETINGS_URL, parsePrimeGovAgenda, parsePrimeGovMeetings } from "./primegov";

// Same fields and item markup as the public portal's October 27, 2026 agenda.
const meeting = (over = {}) => ({
  id: 1793, committeeId: 15, title: "Planning & Zoning Commission - Regular Meeting",
  dateTime: "2026-10-27T18:00:00", time: "06:00 PM", location: "City Hall",
  documentList: [
    { id: 28041, templateId: 10220, templateName: "HTML Agenda", compileOutputType: 3, link: null },
    { id: 28048, templateId: 10222, templateName: "Packet", compileOutputType: 1, link: null },
  ], ...over,
});
const agendaUrl = "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10220";
const html = `
<table class="item-table-fromdocx"><tr><td class="agenda-item" id="AgendaItem_35685" data-itemid="35685">
<p>Whitewater (ANN-00361-2026, MPC-00007-2026).</p>
<div class="item_contents"><div class="attachment-holder">
<a title="View Whitewater Staff Report" href="/viewer/preview?id=0&amp;type=8&amp;uid=whitewater"></a>
<a href="/api/compilemeetingattachmenthistory/historyattachment/?historyId=whitewater">Whitewater Staff Report.PZ</a>
</div><div class="attachment-holder"><a href="/other">Publication affidavit for CUP-99999-2026</a></div></div>
</td></tr></table>
<table><tr><td class="agenda-item" id="AgendaItem_35686" data-itemid="35686">
<p>Code amendment (ZTA-00050-2026)</p><div class="item_contents"><div class="attachment-holder">
<a href="/api/compilemeetingattachmenthistory/historyattachment/?historyId=zoning">Zoning Staff_Report</a>
</div></div></td></tr></table>`;

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("parsePrimeGovMeetings", () => {
  it("accepts the actual feed schema and filters to the three requested committees", () => {
    const result = parsePrimeGovMeetings([
      meeting(), meeting({ id: 1804, committeeId: 1 }),
      meeting({ id: 1805, committeeId: 4 }), meeting({ id: 1597, committeeId: 16 }),
    ]);
    expect(result.map((m) => m.body)).toEqual(["P&Z", "City Council", "Arts & Historic Preservation"]);
    expect(result[0]).toMatchObject({ date: "2026-10-27", timeLabel: "06:00 PM", agendaUrl,
      htmlAgendaUrl: agendaUrl,
      packetUrl: "https://nampa.primegov.com/Public/CompiledDocument?meetingTemplateId=10222&compileOutputType=1" });
  });

  it("keeps PDF-only meetings and meetings whose agenda has not been published", () => {
    const result = parsePrimeGovMeetings([
      meeting({ documentList: [{ id: 27758, templateId: 10286, templateName: "Agenda", compileOutputType: 1, link: null }] }),
      meeting({ id: 2, documentList: [] }),
    ]);
    expect(result[0].agendaUrl).toContain("/Public/CompiledDocument?meetingTemplateId=10286");
    expect(result[0].htmlAgendaUrl).toBeUndefined();
    expect(result[1].agendaUrl).toBeUndefined();
  });

  it("rejects an invalid feed rather than silently interpreting it as no meetings", () => {
    expect(() => parsePrimeGovMeetings({ error: "Unavailable" })).toThrow("Invalid PrimeGov");
  });
});

describe("parsePrimeGovAgenda", () => {
  it("matches each case to its own item anchor and staff report", () => {
    const items = parsePrimeGovAgenda(html, agendaUrl);
    expect(items).toHaveLength(2);
    expect(items[0].caseIds).toEqual(["ANN-00361-2026", "MPC-00007-2026"]);
    expect(items[0].agendaUrl).toBe(agendaUrl + "#AgendaItem_35685");
    expect(items[0].staffReports).toEqual([{ label: "Whitewater Staff Report.PZ",
      url: "https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=whitewater" }]);
    expect(items[1].staffReports[0].url).toContain("historyId=zoning");
    expect(items[0].caseIds).not.toContain("CUP-99999-2026");
  });

  it("rejects unavailable agenda pages", () => {
    expect(() => parsePrimeGovAgenda("<title>Document Not Found</title>", agendaUrl)).toThrow("agenda unavailable");
  });

  it("does not expose unsafe attachment URLs", () => {
    const items = parsePrimeGovAgenda(html.replaceAll("/api/compilemeetingattachmenthistory/historyattachment/?historyId=whitewater", "javascript:alert(1)")
      .replaceAll("/viewer/preview?id=0&amp;type=8&amp;uid=whitewater", "https://untrusted.example/report"), agendaUrl);
    expect(items[0].staffReports).toEqual([]);
  });
});

describe("getNampaPrimeGovMeetings", () => {
  it("loads the list and HTML agenda, associating matched cases", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json([meeting()])).mockResolvedValueOnce(new Response(html));
    vi.stubGlobal("fetch", fetcher);
    const result = await getNampaPrimeGovMeetings();
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([NAMPA_PRIMEGOV_MEETINGS_URL, agendaUrl]);
    expect(result[0].items[0].caseIds).toContain("ANN-00361-2026");
  });

  it("logs an API failure and returns no PrimeGov meetings", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    expect(await getNampaPrimeGovMeetings()).toEqual([]);
    expect(log).toHaveBeenCalledWith("[nampa:primegov] Upcoming meetings failed", expect.any(Error));
  });

  it("keeps other meetings when one HTML agenda fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === NAMPA_PRIMEGOV_MEETINGS_URL) return Response.json([meeting(), meeting({ id: 2, committeeId: 4, documentList: [] })]);
      throw new Error("Network failed");
    }));
    const result = await getNampaPrimeGovMeetings();
    expect(result).toHaveLength(2);
    expect(result[0].items).toEqual([]);
    expect(result[1].body).toBe("Arts & Historic Preservation");
    expect(log).toHaveBeenCalledTimes(1);
  });
});
