import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNampaScheduledHearings,
  NAMPA_CIVICPLUS_HEARINGS_URL,
  NAMPA_PUBLIC_HEARINGS_URL,
  parseNampaScheduledHearings,
} from "./cityofnampa";

// Trimmed fixture of the live "Upcoming Public Hearings" section. Exercises:
//  - single APPID per bullet
//  - multiple APPIDs per bullet (Madison Ranch x3, Sagewood x2)
//  - continuance note in an <em> (Bolinger on April 28)
//  - same APPID reappearing on a later meeting (Bolinger on May 12)
//  - APPID anchor text wrapped in parens ("(VAR-00211-2026)")
//  - trailing comma / trailing close-paren inside anchor text
//  - both P&Z and City Council headings
const FIXTURE = `
<h2 class="subhead1" data-pasted="true"><em>Upcoming Public Hearings</em></h2>
<h3 data-pasted="true" aria-level="2" aria-hidden="true" tabindex="-1"><em>&nbsp;&nbsp;</em></h3>
<h3 aria-level="2">April 28, 2026 - Planning &amp; Zoning - Public Hearings at 6:00 PM</h3>
<ul>
  <li>Comprehensive Plan Text Amendment for City of Nampa (<a href="https://h/Apps/SelfService#/plan/fe2dc425-4f24-44c0-a449-765f05c3de35">CTA-00023-2026</a>)</li>
  <li>Comprehensive Plan Map Amendment, Annexation &amp; Zoning and Subdivision Preliminary Plat for Madison Ranch Estates Subdivision (<a href="https://h/Apps/SelfService#/plan/5acbc6c2-2222-459a-a3a0-7a65a7fe516c">CMA-00066-2026</a>, <a href="https://h/Apps/SelfService#/plan/13b130b8-b8a2-4427-a40c-7439716aca50">ANN-00351-2026,</a> <a href="https://h/Apps/SelfService#/plan/6659faff-2022-4896-8683-c77f6ccbc909">SPP-00173-2026</a>)</li>
  <li>Comprehensive Plan Map Amendment for Bolinger Cottages (<a href="https://h/Apps/SelfService#/plan/8cb6d68e-7478-49a9-970b-c928c6a443a9">CMA-00069-2026</a>) <em>*Continued to 5/12/26 due to non compliance of property posting *</em></li>
</ul>
<h3 aria-level="2">May 4, 2026 - City Council - Council meets at 5:00 PM, Public Hearings at 6:00 PM &nbsp;</h3>
<ul>
  <li>Annexation &amp; Zoning and Subdivision Preliminary Plat for Sagewood Subdivision at 0 &amp; 0 Lewis Lane (<a href="https://h/Apps/SelfService#/plan/2dc6d11f-3ed4-4092-ac90-34a39385a4c2">ANN-00346-2026</a>, <a href="https://h/Apps/SelfService#/plan/e7137750-8af3-4290-9e6a-38ccd5b76d47">SPP-00170-2025)</a>)</li>
</ul>
<h3 aria-level="2">May 12, 2026 - Planning &amp; Zoning - Public Hearings at 6:00 PM</h3>
<ul>
  <li>Comprehensive Plan Map Amendment for Bolinger Cottages (<a href="https://h/Apps/SelfService#/plan/8cb6d68e-7478-49a9-970b-c928c6a443a9">CMA-00069-2026</a>)</li>
</ul>
<h3 aria-level="2">May 18, 2026 - City Council - Council meets at 5:00 PM, Public Hearings at 6:00 PM</h3>
<ul role="presentation">
  <li>Variance of minimum lot size for Cherry Grove No 6 at 0 Elm Lane <a href="https://h/Apps/SelfService#/plan/8915b6ed-4753-459a-9441-b2eec40341dc">(VAR-00211-2026)</a></li>
</ul>
<h2>Next section, should be ignored</h2>
<h3>June 1, 2026 - Planning &amp; Zoning</h3>
<ul><li>Ignored (FOO-99999-9999)</li></ul>
`;

const rows = parseNampaScheduledHearings(FIXTURE);

describe("parseNampaScheduledHearings", () => {
  it("returns an empty list when the section is absent", () => {
    expect(parseNampaScheduledHearings("<div>no hearings here</div>")).toEqual(
      [],
    );
  });

  it("extracts one row per APPID and stops at the next <h2>", () => {
    const ids = rows.map((r) => r.appId);
    expect(ids).toEqual([
      "CTA-00023-2026",
      "CMA-00066-2026",
      "ANN-00351-2026",
      "SPP-00173-2026",
      "CMA-00069-2026",
      "ANN-00346-2026",
      "SPP-00170-2025",
      "CMA-00069-2026",
      "VAR-00211-2026",
    ]);
  });

  it("parses the heading into ISO date, label, body, and bodyLabel", () => {
    const cta = rows.find((r) => r.appId === "CTA-00023-2026")!;
    expect(cta.date).toBe("2026-04-28");
    expect(cta.dateLabel).toBe("April 28, 2026");
    expect(cta.body).toBe("P&Z");
    expect(cta.bodyLabel).toBe("Planning & Zoning Commission");

    const vr = rows.find((r) => r.appId === "VAR-00211-2026")!;
    expect(vr.date).toBe("2026-05-18");
    expect(vr.body).toBe("City Council");
    expect(vr.bodyLabel).toBe("City Council");
  });

  it("fans out a single bullet with multiple APPIDs, sharing the same description", () => {
    const madison = rows.filter((r) =>
      ["CMA-00066-2026", "ANN-00351-2026", "SPP-00173-2026"].includes(r.appId),
    );
    expect(madison).toHaveLength(3);
    for (const r of madison) {
      expect(r.date).toBe("2026-04-28");
      expect(r.description).toMatch(/Madison Ranch Estates Subdivision$/);
      expect(r.description).not.toMatch(/CMA-|ANN-|SPP-/);
      expect(r.description).not.toMatch(/\(\s*\)/);
      expect(r.continuedNote).toBeNull();
    }
  });

  it("captures the continuance note on the original date and leaves it null on the rescheduled one", () => {
    const occurrences = rows.filter((r) => r.appId === "CMA-00069-2026");
    expect(occurrences).toHaveLength(2);
    const [first, second] = occurrences.sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    expect(first.date).toBe("2026-04-28");
    expect(first.continuedNote).toBe(
      "Continued to 5/12/26 due to non compliance of property posting",
    );
    expect(second.date).toBe("2026-05-12");
    expect(second.continuedNote).toBeNull();
  });

  it("extracts the EnerGov plan GUID from the anchor href and lowercases it", () => {
    const cta = rows.find((r) => r.appId === "CTA-00023-2026")!;
    expect(cta.energovPlanId).toBe("fe2dc425-4f24-44c0-a449-765f05c3de35");
  });

  it("accepts APPID anchor text that includes surrounding parens", () => {
    const vr = rows.find((r) => r.appId === "VAR-00211-2026")!;
    expect(vr.energovPlanId).toBe("8915b6ed-4753-459a-9441-b2eec40341dc");
    expect(vr.description).toMatch(/Cherry Grove No 6/);
  });

  it("ignores anchors with a trailing comma or close-paren inside the link text", () => {
    const sagewood = rows.filter((r) =>
      ["ANN-00346-2026", "SPP-00170-2025"].includes(r.appId),
    );
    expect(sagewood.map((r) => r.appId).sort()).toEqual([
      "ANN-00346-2026",
      "SPP-00170-2025",
    ]);
  });

  it("includes the canonical sourceUrl on every row", () => {
    for (const r of rows) {
      expect(r.sourceUrl).toBe(
        "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings",
      );
    }
  });
});


describe("getNampaScheduledHearings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses CivicPlus first with browser headers and preserves public source URLs", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(FIXTURE));
    vi.stubGlobal("fetch", fetcher);
    const result = await getNampaScheduledHearings();
    expect(result).toHaveLength(rows.length);
    expect(result.every((r) => r.sourceUrl === NAMPA_PUBLIC_HEARINGS_URL)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(NAMPA_CIVICPLUS_HEARINGS_URL, expect.objectContaining({
      headers: expect.objectContaining({
        "User-Agent": expect.stringContaining("Mozilla/5.0"),
        Accept: expect.stringContaining("text/html"),
        "Accept-Language": "en-US,en;q=0.9",
      }),
    }));
  });

  it.each([
    ["403", () => new Response("Forbidden", { status: 403 })],
    ["challenge HTML", () => new Response("<title>Just a moment...</title><script src='/cdn-cgi/challenge-platform/a'></script>")],
    ["challenge header", () => new Response(FIXTURE, { headers: { "cf-mitigated": "challenge" } })],
    ["unexpected page", () => new Response("<html>Service unavailable</html>")],
  ])("logs %s as a failure and tries the public host", async (_name, response) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response(FIXTURE));
    vi.stubGlobal("fetch", fetcher);
    expect(await getNampaScheduledHearings()).toHaveLength(rows.length);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      NAMPA_CIVICPLUS_HEARINGS_URL, NAMPA_PUBLIC_HEARINGS_URL,
    ]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain(NAMPA_CIVICPLUS_HEARINGS_URL);
    expect(log.mock.calls[0][1]).toBeInstanceOf(Error);
  });

  it("rejects rather than returning an empty list when both hosts fail", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }))
      .mockResolvedValueOnce(new Response("<title>Just a moment...</title>")));
    await expect(getNampaScheduledHearings()).rejects.toThrow("Meeting schedule temporarily unavailable");
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("falls back after a network error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(new Response(FIXTURE));
    vi.stubGlobal("fetch", fetcher);
    expect(await getNampaScheduledHearings()).toHaveLength(rows.length);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("accepts a valid schedule section with no listed cases", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("<h2>Upcoming Public Hearings</h2><p>None scheduled.</p>"));
    vi.stubGlobal("fetch", fetcher);
    expect(await getNampaScheduledHearings()).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});


describe("published public hearing time", () => {
  it("extracts the hearing time rather than the earlier Council meeting start", () => {
    const council = parseNampaScheduledHearings(FIXTURE).find((r) => r.body === "City Council")!;
    expect(council.time).toBe("18:00");
  });
});
