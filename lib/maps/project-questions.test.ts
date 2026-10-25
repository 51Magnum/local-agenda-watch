import { expect, it } from "vitest";
import {
  questionEvidence,
  progressOutcome,
  RESIDENT_QUESTIONS,
} from "./project-questions";
import { AREAS } from "@/lib/areas/registry";
import type { EvidenceField } from "@/lib/timeline/types";
it("organizes the resident experience around exactly the six guiding questions", () => {
  expect(RESIDENT_QUESTIONS).toEqual([
    "What is it",
    "Where is it",
    "What's happened",
    "What's next",
    "How it affects me",
    "How can I act",
  ]);
});
it("never places unapproved testimony or votes in the resident pane", () => {
  const fields = [
    { key: "pzVote", status: "pending", value: "4-0" },
    { key: "pzSpeakersFor", status: "auto_published", value: "2" },
    {
      key: "councilVote",
      status: "approved",
      value: "5-0",
      sourceUrl: "https://city.example/minutes.pdf",
      page: 4,
    },
  ] as EvidenceField[];
  const data = questionEvidence(fields, AREAS.nampa);
  expect(data.history).toHaveLength(1);
  expect(data.history[0].label).toContain("City Council");
  expect(data.history[0].source).toContain("#page=4");
  expect(questionEvidence([], AREAS.nampa).impacts).toEqual([]);
});

it("keeps unchecked vote tallies out of compact source outcomes", () => {
  expect(progressOutcome("P&Z recommended approval 4–1 (Sep 29)")).toBe(
    "P&Z recommended approval (Sep 29)",
  );
  expect(progressOutcome("Approved unanimously by Council, Oct 19")).toBe(
    "Approved by Council, Oct 19",
  );
});
