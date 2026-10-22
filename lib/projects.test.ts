import { describe, expect, it } from "vitest";
import { braeburnCreek, getProjectForCase, getProjectNextHearing, getProjectStage, hearingCalendar, projectPathForCase } from "./projects";
import { getCaseStage } from "./localities/stages";
import type { Hearing } from "./localities/types";

const now = new Date("2026-10-22T18:00:00Z");
const caseRecord = (over: Partial<Hearing> = {}): Hearing => ({ appId: "ANN-00371-2026", appType: "ANN", appTypeLabel: "Annexation", appStatus: "Pending", appPhase: "City Council", appPhaseRaw: "City Council", appScope: "Braeburn Creek", appAcres: 138, externalUrl: null, energovPlanId: null, meetings: [], ...over });

describe("project grouping", () => {
  it("groups annexation/zoning and subdivision under Braeburn Creek", () => {
    expect(getProjectForCase("ANN-00371-2026")).toBe(braeburnCreek);
    expect(getProjectForCase("spp-00184-2026")).toBe(braeburnCreek);
    expect(braeburnCreek.caseIds).toEqual(braeburnCreek.cases.map((c) => c.id));
    expect(projectPathForCase("ANN-00371-2026")).toBe("/braeburn-creek");
    expect(getProjectForCase("ANN-00370-2026")).toBeUndefined();
    expect(projectPathForCase("ANN-00370-2026")).toBe("/plan/ANN-00370-2026");
  });
});

describe("project next step", () => {
  it("uses the confirmed November 2 hearing and a separate noon deadline", () => {
    const next = getProjectNextHearing(braeburnCreek, undefined, now)!;
    expect(next.startsAt).toBe("2026-11-02T18:00:00-07:00");
    expect(next.commentDeadline).toBe("2026-11-02T12:00:00-07:00");
    expect(getProjectStage(braeburnCreek, undefined, now)).toBe("Council hearing");
  });

  it("has no hearing when neither the project nor the feed supplies one", () => {
    expect(getProjectNextHearing({ ...braeburnCreek, nextHearing: undefined }, undefined, now)).toBeUndefined();
  });

  it("does not recycle a past, continued, or fully decided hearing", () => {
    expect(getProjectNextHearing(braeburnCreek, undefined, new Date("2026-11-04T00:00:00Z"))).toBeUndefined();
    const active = [caseRecord({ meetings: [{ date: "2026-11-02", dateLabel: "November 2, 2026", body: "City Council", bodyLabel: "City Council", continuedNote: "Continued, new date pending", sourceUrl: "https://www.cityofnampa.us" }] })];
    expect(getProjectNextHearing(braeburnCreek, { active, completed: [] }, now)).toBeUndefined();
    const completed = braeburnCreek.caseIds.map((appId) => caseRecord({ appId }));
    expect(getProjectNextHearing(braeburnCreek, { active: [], completed }, now)).toBeUndefined();
  });

  it("prefers a live rescheduled date and does not assume its time or comment deadline", () => {
    const record = caseRecord({ meetings: [{ date: "2026-11-16", dateLabel: "November 16, 2026", body: "City Council", bodyLabel: "City Council", continuedNote: null, sourceUrl: "https://www.cityofnampa.us" }] });
    const next = getProjectNextHearing(braeburnCreek, { active: [record], completed: [] }, now)!;
    expect(next.startsAt).toBe("2026-11-16");
    expect(next.commentDeadline).toBeUndefined();
    expect(hearingCalendar(braeburnCreek, next)).toBeUndefined();
  });
});

describe("consistent stages", () => {
  it("prioritizes the next hearing over an intermediate approval status", () => {
    expect(getCaseStage(caseRecord({ appStatus: "Approved" }), false, now)).toBe("Council hearing");
    expect(getCaseStage(caseRecord(), true, now)).toBe("Decided");
    expect(getCaseStage(caseRecord({ decisionRecorded: true }), false, now)).toBe("Decided");
  });
  it.each([
    [{ appId: "X", appPhase: "Review", appStatus: "In review" }, "Under review"],
    [{ appId: "X", appPhase: "PZ Commission" }, "P&Z hearing"],
    [{ appId: "X", appPhase: "Other", appStatus: "New" }, "Submitted"],
    [{ appId: "X", appPhase: "Other", appStatus: "Approved" }, "Decided"],
  ] as const)("maps source fields to one stage", (fields, expected) => {
    expect(getCaseStage(caseRecord(fields), false, now)).toBe(expected);
  });
});

describe("hearing calendar", () => {
  it("encodes 6 p.m. Denver after DST ends as November 3 at 01:00 UTC", () => {
    const calendar = hearingCalendar(braeburnCreek, braeburnCreek.nextHearing!)!;
    expect(calendar).toContain("DTSTART:20261103T010000Z\r\n");
    expect(calendar).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    expect(calendar).toContain("LOCATION:Nampa City Hall\\, Council Chambers\\, 411 3rd St S\\, Nampa\\, ID");
    expect(calendar.split("\r\n").every((line) => Buffer.byteLength(line) <= 75)).toBe(true);
  });
});
