import type { ProjectStage } from "@/lib/projects";

/** Keep the same destinations when entering a case from its project or archive. */
export function stageNavigationLinks(caseHref: string, archiveHref: string): Record<ProjectStage, string> {
  const body = (value: string) => archiveHref + (archiveHref.includes("?") ? "&" : "?") + "body=" + encodeURIComponent(value);
  return {
    Submitted: caseHref + "#case-status",
    "Under review": caseHref + "#case-documents",
    "P&Z hearing": body("P&Z"),
    "Council hearing": body("City Council"),
    Decided: caseHref + "#case-status",
  };
}
