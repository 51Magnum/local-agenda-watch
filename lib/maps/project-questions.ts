import type { MapCase } from "./types";
import type { AreaDefinition } from "@/lib/areas/registry";
import type { EvidenceField } from "@/lib/timeline/types";
import type { ProjectHearing } from "@/lib/projects";
export const RESIDENT_QUESTIONS = [
  "What is it",
  "Where is it",
  "What's happened",
  "What's next",
  "How it affects me",
  "How can I act",
] as const;
export type PaneData = {
  relatedCases?: {
    areaId: string;
    caseId: string;
    href: string;
    label: string;
  }[];
  item: MapCase;
  area: {
    id: string;
    name: string;
    timezone: string;
    planningBody: string;
    decisionBody: string;
  };
  where?: string;
  history: { label: string; source?: string }[];
  next?: ProjectHearing & { role: string };
  impacts: { label: string; value: string; url?: string }[];
  conditions: string[];
  commentUrl?: string;
  commentInstructions?: string;
  calendarHref?: string;
  updatedAt: string;
  caseIds: string[];
};
/** Receives public evidence only; votes/testimony additionally require an explicit human approval. */
export function questionEvidence(
  fields: EvidenceField[],
  area: AreaDefinition,
) {
  const fact = (key: string) =>
    fields
      .filter((f) => f.key === key)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const impacts = [
    ["Traffic", "trafficSummary"],
    ["Schools", "schoolComment"],
  ].flatMap(([label, key]) => {
    const f = fields
      .filter((f) => f.sourceKind === "staff-report" && f.key === key)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return f
      ? [
          {
            label,
            value: f.value,
            url: f.sourceUrl + (f.page ? "#page=" + f.page : ""),
          },
        ]
      : [];
  });
  const conditions = fact("councilConditions") ?? fact("pzConditions");
  const history = fields
    .filter(
      (f) =>
        f.status === "approved" &&
        /^(?:pz|council)(?:Vote|Speakers)/.test(f.key),
    )
    .map((f) => ({
      label:
        (f.key.startsWith("pz")
          ? area.bodies.planning.label
          : area.bodies.decision.label) +
        " · " +
        (f.key.endsWith("Vote")
          ? "Vote"
          : f.key.endsWith("For")
            ? "Speakers in support"
            : f.key.endsWith("Against")
              ? "Speakers opposed"
              : "Neutral speakers") +
        ": " +
        f.value,
      source: f.sourceUrl + (f.page ? "#page=" + f.page : ""),
    }));
  return {
    impacts,
    conditions:
      conditions?.value
        .split(/\n+/)
        .map((s) => s.replace(/^[-•]\s*/, ""))
        .filter(Boolean) ?? [],
    history,
  };
}

/** Compact source outcomes never carry unchecked tallies; approved votes have their own sourced history rows. */
export function progressOutcome(label: string) {
  return label
    .replace(/\b(?:vote[ds]?\s*)?\d+\s*[-–]\s*\d+(?:\s*[-–]\s*\d+)?\b/gi, "")
    .replace(/\bunanimous(?:ly)?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
