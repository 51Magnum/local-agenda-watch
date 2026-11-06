import {afterEach,expect,it,vi} from "vitest";
import {readReviewSnapshot} from "../jurisdictions/review-snapshot";
import {publishedFlumAreas,enabledPlanningAreas} from "./flum-areas";
import {preparedFlumSnapshot} from "./prepared-flum";
import {getJurisdiction} from "./jurisdictions";
import {readFlumSnapshot,exportFlumPage} from "./store";
vi.mock("../database-pool",()=>({Pool:class{constructor(){throw Error("FLUM must not open a database");}}}));
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
it("includes Boise only when the published metadata lists it, retaining legacy areas and excluding disabled entries",()=>{
 expect(enabledPlanningAreas([readReviewSnapshot("boise")!.area,readReviewSnapshot("sample-escribe")!.area]).map(a=>a.id)).toEqual(["boise"]);
 expect(publishedFlumAreas(["nampa"]).map(a=>a.id)).toEqual(["nampa"]);
 expect(publishedFlumAreas(["nampa","boise","boise","sample-escribe","unknown"]).map(a=>a.id)).toEqual(["nampa","boise"]);
});
it("configures Blueprint Boise with the city's category field and official source",()=>{
 const config=getJurisdiction("boise")!;expect(config.flum).toMatchObject({planName:"Blueprint Boise",label:"Blueprint Boise · Future Land Use",categoryField:"LandUse",adoptedDate:null});expect(config.flum.layerUrl).toContain("WHM6qC35aMtyAAlN/ArcGIS/rest/services/FutureLandUse/FeatureServer/0");
 const data=preparedFlumSnapshot("boise")!;expect(data.geojson.features).toHaveLength(457);expect(data.legend.some(l=>l.value==="Downtown Mixed Use")).toBe(true);
 for(const f of data.geojson.features)expect(Object.keys(f.properties??{})).toEqual(["LandUse"]);
 expect(JSON.stringify(data)).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
});
it("serves prepared Boise land use in zero-DB Preview without requesting the live GIS",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("DATABASE_URL","");const fetch=vi.spyOn(globalThis,"fetch").mockRejectedValue(Error("No live source requests"));
 const data=await readFlumSnapshot("boise");expect(data?.geojson.features).toHaveLength(457);expect(fetch).not.toHaveBeenCalled();
 data!.geojson.features.length=0;expect(preparedFlumSnapshot("boise")!.geojson.features).toHaveLength(457);
});
it("returns the same prepared source through the project-map FLUM endpoint in Preview",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("DATABASE_URL","");const {GET}=await import("../../app/api/maps/[jurisdiction]/route");
 const response=await GET(new Request("https://test/api/maps/boise?layer=flum"),{params:Promise.resolve({jurisdiction:"boise"})});expect(response.status).toBe(200);expect((await response.json()).geojson.features).toHaveLength(457);
});


it("exports prepared Boise land use in bounded pages without a production database",async()=>{
 vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("DATABASE_URL","fixture-should-never-connect");const first=await exportFlumPage("boise",0),second=await exportFlumPage("boise",250);expect(first.features).toHaveLength(250);expect(first.nextOffset).toBe(250);expect(second.features).toHaveLength(207);expect(second.nextOffset).toBeUndefined();
});
