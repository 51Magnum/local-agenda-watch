import { expect, it } from "vitest";
import { workflowReviewStart } from "./workflow";
it("sources an explicit Review start without substituting scheduled, completed or unrelated dates", () => {
  expect(workflowReviewStart([{ Name: "Review", ActualStartDate: "2026-08-11T09:00:00" }])).toEqual({ value: "2026-08-11", quote: "Workflow Review — ActualStartDate: 2026-08-11T09:00:00" });
  expect(workflowReviewStart([{ Name: "Review", ScheduledDate: "2026-08-01", StartDate: "2026-08-01", CompleteDate: "2026-08-02" }, { Name: "Council hearing", ActualStartDate: "2026-11-02" }])).toBeUndefined();
});
