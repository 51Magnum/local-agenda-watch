import { afterEach, expect, it, vi } from "vitest";
import MapPage, { generateMetadata } from "./page";
import { JURISDICTIONS } from "@/lib/maps/jurisdictions";
vi.mock("next/navigation", () => ({ permanentRedirect: (url: string) => { throw new Error("redirect:" + url); }, notFound: () => { throw new Error("not-found"); } }));
afterEach(() => { delete JURISDICTIONS["test-area"]; });
it("redirects the old Nampa map to the city page with query parameters retained", async () => {
  await expect(MapPage({ params: Promise.resolve({ jurisdiction:"nampa" }), searchParams: Promise.resolve({stage:"Council hearing",tag:["one","two"]}) })).rejects.toThrow("redirect:/nampa?stage=Council+hearing&tag=one&tag=two");
  expect((await generateMetadata({params:Promise.resolve({jurisdiction:"nampa"})})).alternates?.canonical).toBe("https://www.localagendawatch.com/nampa");
});
it("keeps shared map rendering available for jurisdictions whose hub is not yet configured",async()=>{
  JURISDICTIONS["test-area"]={...JURISDICTIONS.nampa,id:"test-area",name:"Test Area",mapOnHub:false};
  expect(await MapPage({params:Promise.resolve({jurisdiction:"test-area"})})).toBeTruthy();
  expect((await generateMetadata({params:Promise.resolve({jurisdiction:"test-area"})})).alternates?.canonical).toBe("https://www.localagendawatch.com/test-area/map");
});
it("rejects unknown jurisdictions",async()=>{await expect(MapPage({params:Promise.resolve({jurisdiction:"unknown"})})).rejects.toThrow("not-found");});
