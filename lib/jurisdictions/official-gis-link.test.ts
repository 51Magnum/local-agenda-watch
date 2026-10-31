import {expect,it} from "vitest";
import {officialFeatureLink,officialGisLink} from "./official-gis-link";
import {configuredMap} from "./runtime";
it("turns official GIS fact links into queries and preserves ordinary document sources",()=>{
 const layer="https://gisprodapi.adacounty.id.gov/arcgis/rest/services/LandUse/LandUse/MapServer/20",link=officialFeatureLink(layer,{OBJECTID:7});
 expect(new URL(link!).searchParams.get("where")).toBe("OBJECTID=7");expect(link).not.toMatch(/(MapServer|FeatureServer)\/\d+\/?$/);
 expect(officialGisLink("https://official.test/report.pdf#page=2")).toBe("https://official.test/report.pdf#page=2");
 expect(configuredMap("ada-county").flum.adoptionSource).toContain("/query?");
});
