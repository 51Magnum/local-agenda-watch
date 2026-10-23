import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MapPage, { generateMetadata } from "./page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));

const params = (area: string) => Promise.resolve({ country: "us", state: "id", area });

it("renders the canonical live map with nearby-case support and area metadata", async () => {
  const html = renderToStaticMarkup(await MapPage({ params: params("nampa") }));
  expect(html).toContain('id="case-map"');
  expect(html).toContain('/us/id/nampa');
  expect((await generateMetadata({ params: params("nampa") })).alternates.canonical)
    .toBe("https://www.localagendawatch.com/us/id/nampa/map");
});

it("keeps a coming-soon area boundary-only instead of rendering live case controls", async () => {
  const html = renderToStaticMarkup(await MapPage({ params: params("canyon-county") }));
  expect(html).toContain("Coming soon");
  expect(html).toContain("Canyon County");
  expect(html).not.toContain('id="case-map"');
});

it("rejects an unregistered area", async () => {
  await expect(MapPage({ params: params("unknown") })).rejects.toThrow("not-found");
});
