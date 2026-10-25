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
    officialProjectRecords(AREAS["canyon-county"], [hearing(raw)])[0],
  ).toMatchObject({
    url: "https://landhearingsagenda.canyoncounty.id.gov/Landing",
    label: expect.stringContaining("archive — search case"),
  });
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

it("uses the verified case-specific PrimeGov record instead of a blocked city notice", () => {
  const h = {
    ...hearing(
      "https://nampaid-energovpub.tylerhost.net/Apps/SelfService#/plan/example",
      "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings",
    ),
    appId: "ANN-00368-2026",
  };
  expect(officialProjectRecords(AREAS.nampa, [h])[0]).toEqual({
    url: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062",
    label: "Nampa hearing record · ANN-00368-2026",
  });
});
it("labels a broad Meridian fallback as an archive instead of pretending it is a project record", () => {
  const [link] = officialProjectRecords(AREAS.meridian, [
    hearing("https://weblink.meridiancity.org/WebLink/Browse.aspx?id=123"),
  ]);
  expect(link.url).toContain("meetings.municode.com/");
  expect(link.label).toContain("archive — search case");
});
