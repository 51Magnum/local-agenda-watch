import { describe, expect, it } from "vitest";
import { getTrackedCaseCount } from "./index";
import { nampa } from "./nampa";
import { mapAttrs, type PZAttributes } from "./nampa";

const hearing = (appId: string) => mapAttrs({ APPID: appId } as PZAttributes);

describe("getTrackedCaseCount", () => {
  it("counts unique active, completed and scheduled cases without duplicating featured cases", () => {
    expect(getTrackedCaseCount(nampa, {
      active: [hearing("ANN-00371-2026"), hearing("SPP-00184-2026"), hearing("VAR-00001-2026")],
      upcomingOnly: [hearing("ann-00371-2026"), hearing("CUP-00001-2026")],
      completed: [hearing("OLD-00001-2025")],
    })).toBe(5);
  });

  it("derives the editorial count from data, including unfiled projects", () => {
    const locality = { ...nampa, tracked: [{ kind: "editorial" as const, slug: "unfiled", label: "New proposal" }] };
    expect(getTrackedCaseCount(locality, { active: [], completed: [] })).toBe(1);
    expect(getTrackedCaseCount({ ...locality, tracked: [] })).toBe(0);
    expect(getTrackedCaseCount(nampa)).toBe(nampa.tracked[0].caseIds!.length);
  });
});
