import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AREAS } from "./registry";
import { landUseFact } from "./land-use";
import { ProjectFacts } from "@/app/components/project-overview";
import { braeburnOverview } from "../project-overview";
it("compares every requested district using the jurisdiction's sourced mapping", () => {
  const fact=landUseFact(AREAS.nampa,["Medium Density Residential"],"RS4, RS6 and RS7 (Single-Family Residential)");
  expect(fact?.value).toContain("consistent with requested RS4 / RS6 / RS7 zoning");
  expect(fact?.comparisonSourceUrl).toContain("13801");
  expect(fact?.mapHref).toBe("/us/id/nampa/map?flum=1");
  expect(landUseFact(AREAS.nampa,["Medium Density Residential"],"IL")?.value).toContain("differs from plan");
  expect(landUseFact(AREAS.nampa,["Medium Density Residential"],"RS4 and IL")?.value).toContain("differs from plan");
  expect(landUseFact(AREAS.nampa,["Industrial"],"IL (Light Industrial)")?.value).toContain("consistent with requested IL zoning");
});
it("shows only designations without mapping or zoning and leaves mixed sites unclassified", () => {
  expect(landUseFact(AREAS.nampa,["Unmapped category"],"IL")?.value).toBe("Unmapped Category");
  expect(landUseFact({...AREAS.nampa,flumCompatibility:undefined},["Industrial"],"IL")?.value).toBe("Industrial");
  expect(landUseFact(AREAS.nampa,["Industrial"])?.value).toBe("Industrial");
  expect(landUseFact(AREAS.nampa,["Industrial","Medium Density Residential"],"IL")?.value).toBe("Mixed: Industrial; Medium Density Residential");
});
it("renders one sources control below the facts and links land use to the enabled map", () => {
  const html=renderToStaticMarkup(createElement(ProjectFacts,{overview:braeburnOverview,landUse:landUseFact(AREAS.nampa,["Medium Density Residential"],braeburnOverview.zoning?.value)}));
  expect(html).not.toContain("↗");
  expect(html.match(/<summary/g)).toHaveLength(1);
  expect(html).toContain('href="/us/id/nampa/map?flum=1"');
  expect(html).toContain("page 24");
  expect(html).toContain("Plan / zoning district comparison");
});
