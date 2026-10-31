import {expect,it} from "vitest";
import {applicationRecordUrl} from "./application-source";
import {applicationFromFeature} from "./adapters/arcgis";
import {jurisdiction} from "./registry";
it("uses the full source APPFILE tracker link and never f=html",()=>{
 const d=jurisdiction("ada-county"),a=applicationFromFeature(d,{type:"Feature",geometry:null,properties:{APPFILE:"202601398-CU",AppApplicDesc:"Source proposal"}});
 expect(a.recordUrl).toBe("https://gisprod.adacounty.id.gov/apps/application_tracker/?find=202601398-CU");
 expect(a.sourceUrl).toBe(a.recordUrl);expect(a.recordUrl).not.toContain("f=html");
});
it("keeps Boise's existing case-specific permit tracker deep link",()=>expect(applicationRecordUrl(jurisdiction("boise"),"PLN26-00001")).toContain("QueryText=PLN26-00001"));
