import { describe, expect, it } from "vitest";
import { caseSummary, denverInstant, getCaseNextHearing, staffReportLinks, displayTitle, projectNameFromFiles, uniqueAttachments, uniqueDocumentLinks } from "./case-details";
import type { Hearing } from "./localities/types";
import type { EnerGovAttachment, EnerGovPlan } from "./sources/energov";
import { braeburnCreek, hearingCalendar } from "./projects";

const now = new Date("2026-10-22T18:00:00Z");
const hearing: Hearing = {
  appId: "ANN-00369-2026", appType: "ANN", appTypeLabel: "Annexation", appStatus: "Pending",
  appPhase: "City Council", appPhaseRaw: "City Council", appScope: "Annexation to IL for Warehouse and Manufacturing",
  description: "Annexation & Zoning for Nampa Logistics Center at 17501 Northside Blvd. Original Concept: Warehouse and manufacturing.",
  appAcres: 1.69, externalUrl: null, energovPlanId: null,
  meetings: [{ body: "City Council", bodyLabel: "City Council", date: "2026-11-02", dateLabel: "November 2, 2026", time: "18:00", continuedNote: null, sourceUrl: "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings" }],
};

describe("automatic case next step", () => {
  it("builds a Nov 2 Council hearing with a separate noon deadline", () => {
    const next = getCaseNextHearing(hearing, undefined, now)!;
    expect(next.startsAt).toBe("2026-11-03T01:00:00.000Z");
    expect(next.commentDeadline).toBe("2026-11-02T19:00:00.000Z");
    expect(next.body).toBe("City Council");
    expect(next.location).toContain("411 3rd St S");
    expect(next.agendaUrl).toBeUndefined();
  });

  it("preserves the published hearing time over Council's earlier business start", () => {
    const next = getCaseNextHearing(hearing, { active: [hearing], completed: [], agendaMeetings: [{
      id: "2", body: "City Council", bodyLabel: "City Council", title: "Council regular meeting", date: "2026-11-02", dateLabel: "November 2, 2026",
      localStartTime: "17:00", timeLabel: "05:00 PM", location: "Council Chambers", sourceUrl: "https://nampa.primegov.com/public/portal",
      agendaUrl: "https://nampa.primegov.com/agenda", packetUrl: "https://nampa.primegov.com/packet", items: [],
    }] }, now)!;
    expect(next.startsAt).toBe("2026-11-03T01:00:00.000Z");
    expect(next.agendaUrl).toBe("https://nampa.primegov.com/agenda");
    expect(next.packetUrl).toBe("https://nampa.primegov.com/packet");
  });

  it("supports PrimeGov-only cases and does not apply Council deadlines to other bodies", () => {
    const primeCase = { ...hearing, appPhase: "PZ Commission" as const, meetings: [{ ...hearing.meetings[0], body: "P&Z", bodyLabel: "Planning & Zoning Commission", date: "2026-10-27", time: "18:00", sourceUrl: "https://nampa.primegov.com/public/portal", agendaUrl: "https://nampa.primegov.com/agenda", packetUrl: "https://nampa.primegov.com/packet" }] };
    const next = getCaseNextHearing(primeCase, undefined, now)!;
    expect(next.startsAt).toBe("2026-10-28T00:00:00.000Z");
    expect(next.commentDeadline).toBeUndefined();
    expect(next.agendaUrl).toBeDefined();
  });

  it("does not surface past, continued or decided cases", () => {
    expect(getCaseNextHearing({ ...hearing, decisionRecorded: true }, undefined, now)).toBeUndefined();
    expect(getCaseNextHearing({ ...hearing, meetings: [{ ...hearing.meetings[0], continuedNote: "Continued" }] }, undefined, now)).toBeUndefined();
    expect(getCaseNextHearing(hearing, undefined, new Date("2026-11-04T00:00:00Z"))).toBeUndefined();
  });

  it("creates a case-specific calendar URL and converts Denver daylight-saving offsets", () => {
    expect(denverInstant("2026-10-27", "18:00")).toBe("2026-10-28T00:00:00.000Z");
    expect(denverInstant("2026-11-02", "18:00")).toBe("2026-11-03T01:00:00.000Z");
    const calendar = hearingCalendar({ slug: "ann-00369-2026", title: "Nampa Logistics Center", path: "plan/ANN-00369-2026" }, getCaseNextHearing(hearing, undefined, now)!)!;
    expect(calendar).toContain("URL:https://www.localagendawatch.com/us/id/nampa/plan/ANN-00369-2026");
    expect(calendar).toContain("DTSTART:20261103T010000Z");
  });
});

describe("case summaries and reports", () => {
  it("uses supplied name, type, acres, address and zoning without an AI-generated description", () => {
    expect(caseSummary(hearing, null)).toBe("Northside Logistics Center: annexation of 1.69 acres at 17501 Northside Blvd, Nampa, ID 83687 to IL (light industrial).");
    expect(caseSummary(hearing, { ProjectName: "Portal project", MainAddress: "17501 Northside Blvd\nNampa, ID" } as EnerGovPlan)).toContain("Northside Logistics Center: annexation");
  });

  it("preserves the hand-written Braeburn Creek summary", () => {
    expect(caseSummary({ ...hearing, appId: "ANN-00371-2026" }, null)).toBe(braeburnCreek.summary);
  });

  it("pulls staff reports out of public case attachments, excluding secure files", () => {
    const attachments = [
      { AttachmentID: "1", Notes: "Staff report", FileName: "Report.pdf", IsFileSecure: false },
      { AttachmentID: "2", Notes: "Staff report", FileName: "Private.pdf", IsFileSecure: true },
      { AttachmentID: "3", Notes: "Site plan", FileName: "Site.pdf", IsFileSecure: false },
    ] as EnerGovAttachment[];
    expect(staffReportLinks({ ...hearing, appId: "ANN-99999-2026" }, attachments, "https://portal/attachments")).toEqual([{ label: "Staff report", url: "https://portal/attachments" }]);
  });
});


describe("source-only naming and clean display titles", () => {
  it("uses filenames rather than extracting a name from narrative text", () => {
    expect(projectNameFromFiles("ANN-00369-2026", ["ANN-00369-2026_Northside Logistics Center_Application.pdf"])).toBe("Northside Logistics Center");
    const unnamed = { ...hearing, appId: "ANN-99999-2026", appScope: "Annexation for Some Guessed Name" };
    expect(caseSummary(unnamed, null)).toMatch(/^annexation of 1.69 acres/);
    expect(caseSummary(unnamed, null)).not.toContain("Some Guessed Name:");
  });
  it("drops the city's acreage qualifier from the case type", () => {
    expect(caseSummary(hearing, { PlanType: "Annexation (more than 1 acre)" } as EnerGovPlan)).toContain(": annexation of 1.69 acres");
  });
  it("repairs a small explicit typo list and whitespace", () => {
    expect(displayTitle("Varience  and  Annexaation for zoniong in a Communit")).toBe("Variance and Annexation for zoning in a Community");
  });
  it("deduplicates equivalent filenames and report download/view URLs", () => {
    const files = [{ FileName: "Staff Report.pdf", IsFileSecure: false }, { FileName: "staff report.PDF", IsFileSecure: false }] as EnerGovAttachment[];
    expect(uniqueAttachments(files)).toHaveLength(1);
    expect(uniqueDocumentLinks([{ label: "Download report", url: "https://nampa.primegov.com/file?historyId=123" }, { label: "View report", url: "https://nampa.primegov.com/view?uid=123" }])).toHaveLength(1);
  });
});


import { caseDisplayTitle } from "./case-details";
it.each([
  ["ANN-00358-2026", "Lonestar annexation and master plan"],
  ["MPC-00006-2026", "Lonestar annexation and master plan"],
  ["SPP-00182-2026", "Emberwood preliminary plat"],
  ["CTA-00026-2026", "SH16 Specific Area Plan comprehensive plan text amendment"],
  ["CMA-00074-2026", "SH16 future land-use map comprehensive plan map amendment"],
  ["MPC-00007-2026", "Whitewater master plan"],
  ["ZTA-00050-2026", "Group homes and GB district zoning text amendment"],
  ["SPF-00294-2025", "Silverland Park final plat"],
])("gives %s a short sourced title rather than its raw narrative or filename", (appId, expected) => {
  expect(caseDisplayTitle({ ...hearing, appId, appType: appId.split("-")[0], appScope: "Raw city narrative", description: "Raw official description" }, { ProjectName: "ANN-99999-2026_Application.pdf" } as EnerGovPlan)).toBe(expected);
});
