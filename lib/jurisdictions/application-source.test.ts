import {expect,it} from "vitest";
import {applicationRecordUrl} from "./application-source";
import {applicationFromFeature} from "./adapters/arcgis";
import {jurisdiction} from "./registry";
it("uses the full source APPFILE tracker link and never f=html",()=>{
 const d=jurisdiction("ada-county"),a=applicationFromFeature(d,{type:"Feature",geometry:null,properties:{APPFILE:"202601398-CU",AppApplicDesc:"Source proposal"}});
 expect(a.recordUrl).toBe("https://gisprod.adacounty.id.gov/apps/application_tracker/?find=202601398-CU");
 expect(a.sourceUrl).toBe(a.recordUrl);expect(a.recordUrl).not.toContain("f=html");
});
it("links Boise to its exact official public record view",()=>expect(applicationRecordUrl(jurisdiction("boise"),"PLN26-00001")).toContain("RecordID%3D%27PLN26-00001%27"));
