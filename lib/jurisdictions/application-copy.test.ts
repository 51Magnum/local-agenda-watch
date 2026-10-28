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
  const snapshot={areaId:d.id,checkedAt:"2026-10-28",complete:true,applications:[a],meetings:[{date:"2026-10-15",body:"pzc",title:"PZC",meetingPageUrl:e.sourceUrl,items:[{caseNumbers:[e.id],attachments:[]}]}]} as StagingSnapshot;
  expect(stagedFeed(d,snapshot).active[0].description).toBe(e.description);
  expect(applicationTitle(e.type,e.description).length).toBeLessThanOrEqual(70);
 }
 expect(examples.map(e=>applicationTitle(e.type,e.description))).toMatchSnapshot();
 const disagreement=examples.find(e=>e.id==="202501845-S")!;
 expect(applicationTitle(disagreement.type,disagreement.description)).toMatch(/^Preliminary Plat: Final Plat/);
 expect(disagreement.description).toContain("Final Plat");
});
