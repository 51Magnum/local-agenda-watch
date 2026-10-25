import { expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  config: null as unknown,
  citywide: false,
  record: vi.fn(),
}));
vi.mock("next/cache", () => ({ unstable_cache: (f: unknown) => f }));
vi.mock("./jurisdictions", () => ({ getJurisdiction: () => h.config }));
vi.mock("./store", () => ({
  readMapSnapshot: async () => ({
    updatedAt: "2026-10-25",
    cases: [
      {
        id: "CR2025-0009",
        title: "Example project",
        summary: "",
        href: "/canyon-county/plan/CR2025-0009",
        stage: "In review",
        citywide: h.citywide,
        flumCategories: [],
        geometry: null,
        centroid: null,
        popup: {
          headline: "Example proposal",
          projectName: "Example project",
          progress: [],
        },
      },
    ],
  }),
}));
vi.mock("./popup-data", () => ({
  enrichMapPopups: async (_: unknown, cases: unknown) => cases,
}));
vi.mock("@/lib/timeline/public", async (original) => ({
  ...(await original<typeof import("@/lib/timeline/public")>()),
  readTimelineState: async () => ({
    version: 1,
    documents: {},
    fields: {},
    audit: [],
    runs: [],
    leases: {},
  }),
}));
import { projectDetail } from "./project-detail";
import { AREAS } from "@/lib/areas/registry";
function config() {
  h.citywide = false;
  h.record = vi
    .fn()
    .mockReturnValue({
      address: "Ruth Lane and Happy Valley Road",
      events: [],
      sourceStatus: "In review",
      approvalStatus: "",
    });
  h.config = {
    id: "canyon-county",
    area: AREAS["canyon-county"],
    recordForCase: h.record,
    loadCases: async () => ({
      active: [
        {
          appId: "CR2025-0009",
          appType: "CR",
          appPhase: "Review",
          appStatus: "In review",
          meetings: [],
        },
      ],
      completed: [],
    }),
  };
}
it("uses the same jurisdiction record adapter as full project pages for the Where answer", async () => {
  config();
  const p = await projectDetail("canyon-county", "CR2025-0009");
  expect(p?.where).toBe("Ruth Lane and Happy Valley Road");
  expect(h.record).toHaveBeenCalledTimes(1);
});
it("labels citywide changes without fetching or guessing a physical address", async () => {
  config();
  h.citywide = true;
  const p = await projectDetail("canyon-county", "CR2025-0009");
  expect(p?.where).toBe("Citywide change — Canyon County");
  expect(h.record).not.toHaveBeenCalled();
  expect(p?.impacts.some((i) => i.label === "Proposed density")).toBe(false);
});
