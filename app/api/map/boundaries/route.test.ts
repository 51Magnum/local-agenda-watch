import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {gunzipSync} from "node:zlib";
import {booleanPointInPolygon,point} from "@turf/turf";
import type {BoundaryPayload} from "@/lib/maps/boundary-types";
import review from "@/data/review/ada-county.json";
const h=vi.hoisted(()=>({published:vi.fn()}));
vi.mock("@/lib/jurisdictions/self-check-store",()=>({readPublished:h.published}));
vi.mock("@/lib/jurisdictions/generated",async importOriginal=>({...await importOriginal<object>(),siteReviewAreaIds:["ada-county","sample-escribe"]}));
import {GET} from "./route";
import {legacyCoverageAreas} from "@/lib/areas/registry";
const request=(headers:Record<string,string>={})=>new Request("https://local.test/api/map/boundaries",{headers});
const ids=(payload:BoundaryPayload)=>payload.polygons.features.map(f=>f.properties.id);
const southAda=point([-116.3,43.35]);
const covered=(payload:BoundaryPayload)=>!payload.uncovered.features.some(f=>booleanPointInPolygon(southAda,f));
beforeEach(()=>{h.published.mockReset().mockResolvedValue(undefined);vi.stubEnv("VERCEL_ENV","production");});
afterEach(()=>vi.unstubAllEnvs());
it("includes Ada review coverage, a label and approved legacy coverage in database-free Preview",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("DATABASE_URL","");const body=await(await GET(request())).json() as BoundaryPayload;
 expect(ids(body)).toContain("ada-county");expect(ids(body)).toContain("canyon-county");expect(body.labels.features.some(f=>f.properties?.id==="ada-county")).toBe(true);expect(covered(body)).toBe(true);expect(h.published).not.toHaveBeenCalled();
 const ada=body.polygons.features.find(f=>f.properties.id==="ada-county")!;
 for(const city of legacyCoverageAreas().filter(a=>["meridian","kuna","star","eagle"].includes(a.id)))expect(booleanPointInPolygon(point(city.center),ada),city.id).toBe(false);
});
it("excludes unpublished Ada from production polygons, labels and coverage",async()=>{
 const body=await(await GET(request())).json() as BoundaryPayload;
 expect(ids(body)).not.toContain("ada-county");expect(body.labels.features.some(f=>f.properties?.id==="ada-county")).toBe(false);expect(covered(body)).toBe(false);
});
it("includes an approved production snapshot and changes the ETag when its source hash changes",async()=>{
 let hash="approved-one";h.published.mockImplementation(async id=>id==="ada-county"?{boundary:review.area.boundary,coverageBoundary:review.area.coverageBoundary,selfCheck:{snapshotHash:hash}}:undefined);
 const first=await GET(request()),etag=first.headers.get("etag")!,body=await first.json() as BoundaryPayload;
 expect(ids(body)).toContain("ada-county");expect(covered(body)).toBe(true);
 expect((await GET(request({"if-none-match":etag}))).status).toBe(304);
 hash="approved-two";const second=await GET(request({"if-none-match":etag}));expect(second.status).toBe(200);expect(second.headers.get("etag")).not.toBe(etag);
});
it("retains legacy areas and drops stale published geometry when the snapshot store becomes unreachable",async()=>{
 h.published.mockImplementation(async id=>id==="ada-county"?{boundary:review.area.boundary,coverageBoundary:review.area.coverageBoundary,selfCheck:{snapshotHash:"approved"}}:undefined);await GET(request());
 h.published.mockRejectedValue(Error("Store unreachable"));const body=await(await GET(request())).json() as BoundaryPayload;
 expect(ids(body).sort()).toEqual(legacyCoverageAreas().map(a=>a.id).sort());expect(covered(body)).toBe(false);
});
it("serves compressed JSON with the same version and revalidates publication authority",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");const response=await GET(request({"accept-encoding":"gzip"}));
 expect(response.headers.get("content-encoding")).toBe("gzip");expect(response.headers.get("vary")).toBe("Accept-Encoding");expect(response.headers.get("cache-control")).toContain("no-cache");
 const body=JSON.parse(gunzipSync(new Uint8Array(await response.arrayBuffer())).toString()) as BoundaryPayload;
 expect(body.version).toBe(response.headers.get("X-LAW-Boundary-Version"));expect(ids(body)).toContain("ada-county");
});
