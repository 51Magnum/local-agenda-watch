import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeatureCollection } from "geojson";
import { buildMapSnapshot, normalizeMapStage, parcelNumbers, publicMapData } from "./refresh";
import { JURISDICTIONS } from "./jurisdictions";
import { polygonGeometry, rendererLegend } from "./gis";
import { nearbyCases, flumAtGeometry } from "./spatial";
import { createMapPin, addressWhere, readSharedSearch, searchAddress, searchHash } from "./address-search";
import { POST } from "@/app/api/maps/geocode/route";
import type { CaseGeometry, JurisdictionConfig, MapCase, MapSnapshot } from "./types";
import type { Hearing } from "@/lib/localities/types";
import braeburn from "./fixtures/braeburn.json";
const shape: CaseGeometry = { type: "Polygon", coordinates: [[[-116.51,43.56],[-116.50,43.56],[-116.50,43.57],[-116.51,43.57],[-116.51,43.56]]] };
const feature = (id: string, type = "ANN", geometry: CaseGeometry | null = shape, parcel?: string) => ({ type: "Feature", properties: { KEY: id, TYPE: type, PHASE: "Council", STATUS: "Pending", SCOPE: "Example proposal", PARCEL: parcel }, geometry });
const config: JurisdictionConfig = { ...JURISDICTIONS.nampa, id: "another-area", name: "Another Area", loadCases: undefined, recordClient: undefined, presentation: undefined, caseGeometry: { layers: ["https://gis.test/active", "https://gis.test/completed"], caseIdField: "KEY", fields: { type: "TYPE", phase: "PHASE", status: "STATUS", title: "SCOPE", parcel: "PARCEL" }, parcelFallback: { layerUrl: "https://gis.test/parcels", matchField: "ACCOUNT", recordField: "MainParcelNumber", ignored: ["R1542600000"] } }, flum: { ...JURISDICTIONS.nampa.flum, layerUrl: "https://gis.test/flum", categoryField: "LAND_USE" }, stages: { ...JURISDICTIONS.nampa.stages, phase: { Council: "Council/Board" } } };
const flum = { updatedAt: new Date().toISOString(), geojson: { type: "FeatureCollection" as const, features: [] }, legend: [] };
function mockGis(active: unknown[], completed: unknown[] = []) { return vi.fn(async (input: string | URL | Request) => { const url = String(input); if (url.startsWith(config.flum.layerUrl + "?")) return Response.json({ drawingInfo: { renderer: { uniqueValueInfos: [{ value: "Residential", symbol: { color: [255,170,0,255] } }] } } }); return Response.json({ type: "FeatureCollection", features: url.includes("/active/") ? active : url.includes("/completed/") ? completed : url.includes("/parcels/") ? [{ ...feature("parcel"), properties: { ACCOUNT: "R3055100000", PIN: "wrong-field" } }] : [] }); }); }
const mapCase = (id: string, geometry: CaseGeometry | null = shape): MapCase => ({ id, title: id, summary: "Example", type: "ANN", typeLabel: "Annexation", stage: "Council/Board", href: "/another-area/plan/" + id, geometry, centroid: null, citywide: false, confidence: "exact", source: "polygon", flumCategories: [] });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("jurisdiction geometry refresh", () => {
  it("uses the official Braeburn polygon near Amity & Happy Valley and leaves ZTA only citywide", async () => {
    const c = { ...config, caseGeometry: { ...config.caseGeometry, caseIdField: "APPID", fields: { type: "APPTYPE", phase: "APPPHASE", status: "APPSTATUS", title: "APPSCOPE" } } };
    const zta = { ...braeburn.features[0], properties: { ...braeburn.features[0].properties, APPID: "ZTA-00050-2026", APPTYPE: "ZTA" } };
    vi.stubGlobal("fetch", mockGis([...braeburn.features, zta])); const result = await buildMapSnapshot(c);
    const item = result.cases.find((c) => c.id === "ANN-00371-2026")!;
    expect(item.geometry?.type).toBe("Polygon"); expect(item.source).toBe("polygon"); expect(item.confidence).toBe("exact");
    expect(item.centroid![0]).toBeCloseTo(-116.508, 2); expect(item.centroid![1]).toBeCloseTo(43.565, 2);
    expect(result.cases.find((c) => c.id === "ZTA-00050-2026")).toMatchObject({ citywide: true, geometry: null, centroid: null, confidence: "citywide" });
  });
  it("adds a second jurisdiction through config, including field mappings, routes and stages", async () => {
    vi.stubGlobal("fetch", mockGis([feature("OTHER-123")])); const result = await buildMapSnapshot(config);
    expect(result.jurisdiction).toBe("another-area"); expect(result.cases[0]).toMatchObject({ id: "OTHER-123", stage: "Council/Board", href: "/another-area/plan/OTHER-123", source: "polygon" });
    expect(publicMapData(config, result).jurisdiction.addressPoints).toEqual(config.addressPoints);
  });
  it("matches parcel ACCOUNT, never PIN, and labels fallback approximate", async () => {
    const fetcher = mockGis([feature("FALLBACK", "ANN", null, "R3055100000")]); vi.stubGlobal("fetch", fetcher);
    const result = await buildMapSnapshot(config);
    expect(result.cases[0]).toMatchObject({ source: "parcel match", confidence: "approximate", geometry: shape });
    const query = fetcher.mock.calls.map(([u]) => String(u)).find((u) => u.includes("/parcels/query"))!;
    expect(new URL(query).searchParams.get("where")).toBe("ACCOUNT IN ('R3055100000')"); expect(query).not.toContain("PIN");
  });
  it("never locates a case at the city-office placeholder parcel", async () => {
    const fetcher = mockGis([feature("OFFICE", "ANN", null, "R1542600000")]); vi.stubGlobal("fetch", fetcher);
    const result = await buildMapSnapshot(config); expect(result.cases[0]).toMatchObject({ geometry: null, centroid: null, source: "none", citywide: false }); expect(fetcher.mock.calls.some(([u]) => String(u).includes("/parcels/"))).toBe(false);
    expect(parcelNumbers("R1542600000;R3055100000", config.caseGeometry.parcelFallback.ignored)).toEqual(["R3055100000"]);
  });
  it("reuses FLUM for a week, then refreshes it from renderer metadata", async () => {
    const previous: MapSnapshot = { version: 1, jurisdiction: config.id, updatedAt: new Date().toISOString(), cases: [], flum, warnings: [] };
    const fetcher = mockGis([]); vi.stubGlobal("fetch", fetcher); await buildMapSnapshot(config, previous);
    expect(fetcher.mock.calls.some(([u]) => String(u).includes("/flum"))).toBe(false);
    previous.flum = { ...flum, updatedAt: "2020-01-01T00:00:00Z" }; const refreshed = await buildMapSnapshot(config, previous);
    expect(refreshed.flum!.legend[0]).toMatchObject({ value: "Residential", color: "rgba(255,170,0,1)" });
  });
  it("retains cached outlines during GIS failures", async () => {
    const previous: MapSnapshot = { version: 1, jurisdiction: config.id, updatedAt: new Date().toISOString(), cases: [mapCase("CACHED")], flum, warnings: [] };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline"))); const result = await buildMapSnapshot(config, previous);
    expect(result.cases[0].geometry).toEqual(shape); expect(result.cases[0].stage).toBe("Council/Board"); expect(result.warnings.length).toBeGreaterThan(0);
  });
  it("a Council decision overrides Submitted; recording alone does not mean Recorded", () => {
    const h: Hearing = { appId: "A", appType: "ANN", appTypeLabel: "Annexation", appPhase: "Other", appPhaseRaw: "", appStatus: "Submitted", appScope: null, appAcres: null, externalUrl: null, energovPlanId: null, meetings: [{ body: "City Council", bodyLabel: "City Council", date: "2026-10-19", dateLabel: "October 19", result: "Denied", continuedNote: null, sourceUrl: "https://city.example" }] };
    expect(normalizeMapStage(config, h)).toBe("Decided"); h.meetings[0].body = "Board of County Commissioners"; expect(normalizeMapStage(config, h)).toBe("Decided"); h.meetings = []; h.appPhaseRaw = "Recording"; h.appStatus = "Pending";
    expect(normalizeMapStage(JURISDICTIONS.nampa, h)).toBe("Decided"); h.appStatus = "Complete"; expect(normalizeMapStage(JURISDICTIONS.nampa, h)).toBe("Recorded");
  });
});
describe("map geometry and proximity", () => {
  it("sorts nearby cases by distance to their boundary and excludes citywide and unlocated", () => {
    const far: CaseGeometry = { type: "Polygon", coordinates: [shape.coordinates[0].map(([x,y]) => [x + .015,y])] };
    const citywide = { ...mapCase("CITYWIDE"), citywide: true };
    const result = nearbyCases([mapCase("FAR",far), citywide, mapCase("NONE",null), mapCase("INSIDE")],[-116.505,43.565]);
    expect(result.map((c) => c.id)).toEqual(["INSIDE","FAR"]); expect(result[0].distance).toBe(0); expect(result[1].distance).toBeGreaterThan(.4);
  });
  it("uses renderer colors, validates coordinates and excludes FLUM edge slivers", () => {
    expect(polygonGeometry({ type: "Polygon", coordinates: [[[250000,500000],[1,2],[1,2],[250000,500000]]] })).toBe(false);
    expect(rendererLegend({ uniqueValueGroups: [{ classes: [{ label: "Homes", values: [["R"]], symbol: { color: [255,255,0,128] } }] }] })[0]).toMatchObject({ value:"R", label:"Homes" });
    const fc: FeatureCollection<CaseGeometry> = { type:"FeatureCollection", features:[{ type:"Feature", geometry:shape, properties:{LAND_USE:"Residential"} }] }; expect(flumAtGeometry(shape,fc,"LAND_USE")).toEqual(["Residential"]);
  });
});
describe("private submit-only address lookup", () => {
  it("queries the configured local address field first and caches only in browser session storage", async () => {
    const storage: Record<string,string> = {}; vi.stubGlobal("sessionStorage", { getItem:(k:string)=>storage[k]??null, setItem:(k:string,v:string)=>{storage[k]=v;}, removeItem:(k:string)=>{delete storage[k];} });
    const fetcher=vi.fn().mockResolvedValue(Response.json({ features:[{ properties:{SiteAddres:"17501 NORTHSIDE BLVD"}, geometry:{type:"Point",coordinates:[-116.56,43.61]} }] }));vi.stubGlobal("fetch",fetcher);
    const first = await searchAddress(JURISDICTIONS.nampa,"17501 Northside Boulevard"); const second = await searchAddress(JURISDICTIONS.nampa,"17501 Northside Boulevard"); expect(first).toEqual(second); expect(first[0].source).toBe("local");expect(fetcher).toHaveBeenCalledTimes(1); expect(addressWhere(JURISDICTIONS.nampa,"17501 Northside Boulevard")).toContain("%17501%NORTHSIDE%BLVD%");
  });
  it("falls back to Census through a POST body when local search has no matches",async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({features:[]})).mockResolvedValueOnce(Response.json({results:[{label:"TEST ID",coordinates:[-116.5,43.5],source:"Census"}]}));vi.stubGlobal("fetch",fetcher);await searchAddress(JURISDICTIONS.nampa,"100 Example");expect(fetcher.mock.calls[1]).toMatchObject(["/api/maps/geocode",{method:"POST",cache:"no-store",body:JSON.stringify({jurisdiction:"nampa",address:"100 Example"})}]);
  });
  it("Census keeps Idaho results only, uses the current benchmark, and disables server caching",async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json({result:{addressMatches:[{matchedAddress:"Idaho",addressComponents:{state:"ID"},coordinates:{x:-116.5,y:43.5}},{matchedAddress:"Oregon",addressComponents:{state:"OR"},coordinates:{x:-120,y:44}}]}}));vi.stubGlobal("fetch",fetcher);
    const response=await POST(new Request("http://localhost/api/maps/geocode",{method:"POST",body:JSON.stringify({jurisdiction:"nampa",address:"17501 Northside Blvd"})}));expect(response.headers.get("Cache-Control")).toBe("no-store");expect((await response.json()).results).toHaveLength(1);expect(String(fetcher.mock.calls[0][0])).toContain("benchmark=Public_AR_Current");expect(fetcher.mock.calls[0][1]).toMatchObject({cache:"no-store"});
  });
  it("shares coordinates/address in the fragment, which is not sent to the server",()=>{const location={label:"17501 Northside Blvd, Nampa, ID",coordinates:[-116.56,43.61] as [number,number],source:"local" as const};const url=new URL("https://example.com/another-area/map"+searchHash(location));expect(url.search).toBe("");expect(readSharedSearch(url.hash)).toEqual(location);expect(readSharedSearch("#lng=Infinity&lat=4")).toBeUndefined();expect(readSharedSearch("#lng=400&lat=4")).toBeUndefined();expect(readSharedSearch("#lng=&lat=")).toBeUndefined();});
});

describe("verified popup exhibits", () => {
  it("attaches the same dated developer concept to both Braeburn cases, even for older cached snapshots", () => {
    const snapshot: MapSnapshot = { version: 1, jurisdiction: "nampa", updatedAt: new Date().toISOString(), cases: [mapCase("ANN-00371-2026"), mapCase("SPP-00184-2026"), mapCase("UNKNOWN")], warnings: [] };
    const cases = publicMapData(JURISDICTIONS.nampa, snapshot).cases;
    expect(cases[0].visual).toEqual(cases[1].visual);
    expect(cases[0].visual).toMatchObject({ kind: "proposal", src: "/nampa/braeburn-concept-preview.webp", label: "Developer concept · March 13, 2026", sourceUrl: "/nampa/toll-brothers-concept-plan.png" });
    expect(cases[0].visual?.note).toContain("later submissions may differ");
    expect(cases[2].visual).toBeUndefined();
  });
  it("labels Northside's existing zoning exhibit as context, not a proposed layout", () => {
    const visual = JURISDICTIONS.nampa.caseVisuals?.["ANN-00369-2026"];
    expect(visual).toMatchObject({ kind: "context", note: "Planning context, not a proposed site layout." });
    expect(visual?.sourceUrl).toContain("#page=15");
  });
});

describe("direct map pins", () => {
  it("creates a coordinate location without calling a geocoder and preserves it in share links", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const pin = createMapPin([-116.508098, 43.56527]);
    expect(pin.source).toBe("map"); expect(pin.label).toContain("43.56527");
    expect(readSharedSearch(searchHash(pin))).toEqual(pin);
    expect(fetcher).not.toHaveBeenCalled();
    expect(nearbyCases([mapCase("NEAR")], pin.coordinates)[0].id).toBe("NEAR");
  });
  it("rejects invalid map-pin coordinates", () => { expect(() => createMapPin([NaN,43])).toThrow(); expect(() => createMapPin([-200,43])).toThrow(); });
});
