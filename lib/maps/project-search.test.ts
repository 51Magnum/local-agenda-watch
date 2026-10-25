import { expect, it } from "vitest";
import { findProjects, type ProjectMatch } from "./project-search";
const projects: ProjectMatch[] = [
  { areaId: "nampa", areaName: "Nampa", caseId: "ANN-00371-2026", title: "Braeburn Creek", typeLabel: "Preliminary plat", caseIds: ["SPP-00184-2026"] },
  { areaId: "canyon-county", areaName: "Canyon County", caseId: "CR2024-0001", title: "Mad River Development", typeLabel: "Conditional rezone" },
];
it("finds partial names, linked case numbers, jurisdictions and types without an exact project name", () => {
  for (const query of ["brae", "BRAEBURN", "nampa plat", "spp 00184", "ann-00371"]) expect(findProjects(projects, query)[0]?.title).toBe("Braeburn Creek");
  expect(findProjects(projects, "county rezone")[0]?.title).toBe("Mad River Development");
  expect(findProjects(projects, "missing")).toEqual([]);
  expect(findProjects(projects, "")).toEqual([]);
});
