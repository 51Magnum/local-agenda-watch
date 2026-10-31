import {expect,it} from "vitest";
import {applicationRecordUrl} from "./application-source";
import {applicationFromFeature} from "./adapters/arcgis";
import {jurisdiction} from "./registry";
it("links Ada facts to the project-specific public query instead of the generic tracker or bare layer",()=>{
 const d=jurisdiction("ada-county"),a=applicationFromFeature(d,{type:"Feature",geometry:null,properties:{APPFILE:"202601398-CU",AppApplicDesc:"Source proposal"}});
 for(const href of [a.recordUrl,a.sourceUrl,applicationRecordUrl(d,"202601398-CU-MSP")]){
  const u=new URL(href);expect(u.pathname).toMatch(/MapServer\/14\/query$/);expect(u.searchParams.get("where")).toBe("APPFileNum='202601398'");
  expect(u.searchParams.get("f")).toBe("html");expect(href).not.toMatch(/(MapServer|FeatureServer)\/\d+\/?$/);
 }
});
it("keeps Boise's existing case-specific permit tracker deep link",()=>expect(applicationRecordUrl(jurisdiction("boise"),"PLN26-00001")).toContain("QueryText=PLN26-00001"));
