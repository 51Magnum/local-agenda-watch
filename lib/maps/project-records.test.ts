import { expect, it } from "vitest";
import { officialProjectRecords } from "./project-records";
import { AREAS } from "@/lib/areas/registry";
import type { Hearing } from "@/lib/localities/types";

const hearing = (externalUrl: string | null, sourceUrl?: string) =>
  ({
    appId: "EXAMPLE",
    externalUrl,
    meetings: sourceUrl ? [{ sourceUrl }] : [],
  }) as Hearing;

it("links Nampa's real case portal without substituting our project page", () => {
  const url = "https://nampa.aspgov.com/EnerGov_Prod/SelfService#/plan/example";
  expect(officialProjectRecords(AREAS.nampa, [hearing(url)])[0]).toEqual({
    url,
    label: "Nampa project record · EXAMPLE",
  });
});
it("uses a county agenda for an agenda-only case and never exposes a raw GIS query", () => {
  const raw =
    "https://maps.canyonco.org/arcgisserver/rest/services/DSD/FeatureServer/0/query?f=pjson";
  const url = "https://landhearingsagenda.canyoncounty.id.gov/meeting/example";
  expect(
    officialProjectRecords(AREAS["canyon-county"], [hearing(raw, url)])[0],
  ).toEqual({
    url,
    label: "Canyon County hearing record · EXAMPLE",
  });
  expect(
    officialProjectRecords(AREAS["canyon-county"], [hearing(raw)]),
  ).toEqual([]);
});
it("deduplicates a shared official folder across linked cases", () => {
  const url =
    "https://weblink.meridiancity.org/WebLink/Browse.aspx?dbid=0&startid=123";
  const first = hearing(url),
    second = { ...hearing(url), appId: "LINKED" };
  const links = officialProjectRecords(AREAS.meridian, [first, second]);
  expect(links).toHaveLength(1);
  expect(links[0].label).toContain("EXAMPLE · LINKED");
});
