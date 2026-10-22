import { describe, expect, it } from "vitest";
import { caseSummary, denverInstant, getCaseNextHearing, staffReportLinks } from "./case-details";
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
    const primeCase = { ...hearing, meetings: [{ ...hearing.meetings[0], body: "P&Z", bodyLabel: "Planning & Zoning Commission", date: "2026-10-27", time: "18:00", sourceUrl: "https://nampa.primegov.com/public/portal", agendaUrl: "https://nampa.primegov.com/agenda", packetUrl: "https://nampa.primegov.com/packet" }] };
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
    expect(calendar).toContain("URL:https://www.localagendawatch.com/nampa/plan/ANN-00369-2026");
    expect(calendar).toContain("DTSTART:20261103T010000Z");
  });
});

describe("case summaries and reports", () => {
  it("uses supplied name, type, acres, address and zoning without an AI-generated description", () => {
    expect(caseSummary(hearing, null)).toBe("Nampa Logistics Center: annexation of 1.69 acres at 17501 Northside Blvd to IL (light industrial).");
    expect(caseSummary(hearing, { ProjectName: "Portal project", MainAddress: "17501 Northside Blvd\nNampa, ID" } as EnerGovPlan)).toContain("Portal project: annexation");
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
    expect(staffReportLinks(hearing, attachments, "https://portal/attachments")).toEqual([{ label: "Staff report", url: "https://portal/attachments" }]);
  });
});
