import { expect, it } from "vitest";
import { stageNavigationLinks } from "./stage-navigation";
it("keeps case, year, and subdomain paths in stage destinations", () => {
  expect(stageNavigationLinks("/plan/ANN-00369-2026", "/meetings?case=ANN-00369-2026&year=2025")).toEqual({
    Submitted: "/plan/ANN-00369-2026#case-status",
    "Under review": "/plan/ANN-00369-2026#case-documents",
    "P&Z hearing": "/meetings?case=ANN-00369-2026&year=2025&body=P%26Z",
    "Council hearing": "/meetings?case=ANN-00369-2026&year=2025&body=City%20Council",
    Decided: "/plan/ANN-00369-2026#case-status",
  });
});
