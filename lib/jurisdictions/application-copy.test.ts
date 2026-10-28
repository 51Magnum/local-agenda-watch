import {expect,it} from "vitest";
import examples from "./fixtures/ada-descriptions.json";
import {applicationTitle} from "./application-copy";
import {displayStagedApplication,stagedFeed} from "./resident-records";
import {jurisdiction} from "./registry";
import type {Application} from "./adapters/types";
import type {StagingSnapshot} from "./store";
it("keeps five recorded official descriptions verbatim and titles short",()=>{
 const d=jurisdiction("ada-county");
 for(const e of examples){
  const a:Application={recordId:e.id,name:e.description,type:e.type,description:e.description,status:"Active",address:"",parcel:[],relatedCaseNumbers:[],recordUrl:e.sourceUrl,sourceUrl:e.sourceUrl,sourceFields:{}};
  expect(displayStagedApplication(d,a).description).toBe(e.description);
  // Include an agenda so staff-type examples exercise their eligible presentation.
  const snapshot:StagingSnapshot={areaId:d.id,launchStatus:"admin_only",range:{start:"2026-08-01",end:"2026-12-01"},health:[],skipped:[],checkedAt:"2026-10-28",complete:true,applications:[a],meetings:[{id:"pzc",date:"2026-10-15",body:"pzc",title:"PZC",meetingPageUrl:e.sourceUrl,attachments:[],items:[{itemId:"1",body:"pzc",title:"Source proposal",meetingDateTime:"2026-10-15",meetingPageUrl:e.sourceUrl,caseNumbers:[e.id],attachments:[]}]}]};
  expect(stagedFeed(d,snapshot).active[0].description).toBe(e.description);
  expect(applicationTitle(e.type,e.description).length).toBeLessThanOrEqual(70);
 }
 expect(examples.map(e=>applicationTitle(e.type,e.description))).toMatchSnapshot();
 const disagreement=examples.find(e=>e.id==="202501845-S")!;
 expect(applicationTitle(disagreement.type,disagreement.description)).toMatch(/^Preliminary Plat: Final Plat/);
 expect(disagreement.description).toContain("Final Plat");
});
it("removes repeated procedure words so the recorded hearing subject remains in the title",()=>{
 const description="An application for approval of a Conditional Use and Master Site Plan for a previously approved Contractor's Yard. Request is for a continuance of use with no additional proposed structures.";
 expect(applicationTitle("CONDITIONAL USE",description)).toBe("Conditional Use: previously approved Contractor's Yard");
 expect(description).toContain("Conditional Use and Master Site Plan");
});
