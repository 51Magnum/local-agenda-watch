import {expect,it} from "vitest";
import {locationMetrics} from "./location-metrics";
import {reportMarkdown} from "./report";
import type {StagingSnapshot,QaReport} from "./store";
it("reports application geometry/address and agenda-location gaps separately",()=>{
 const applications=[{recordId:"ONE",address:"1 Main Street",geometry:{type:"Point" as const,coordinates:[0,0]}},{recordId:"TWO",address:"2 Main Street",geometry:{type:"Point" as const,coordinates:[1,1]}},{recordId:"THREE",address:"3 Main Street"},{recordId:"FOUR",address:""}].map(a=>({...a,relatedCaseNumbers:[],name:"Source proposal",description:"Source proposal",type:"Planning",status:"Active",parcel:[],sourceUrl:"https://official.test",recordUrl:"https://official.test",sourceFields:{}}));
 const snapshot:StagingSnapshot={areaId:"fixture",launchStatus:"admin_only",checkedAt:"2026-10-28",range:{start:"2026-08-01",end:"2026-12-01"},health:[],skipped:[],complete:true,applications,meetings:[{id:"m",title:"Official agenda",body:"pz",date:"2026-10-28",meetingPageUrl:"https://official.test",attachments:[],items:["ONE","THREE","FOUR","UNMATCHED-1","UNMATCHED-2"].map(id=>({itemId:id,title:"Source proposal",body:"pz",meetingDateTime:"2026-10-28",meetingPageUrl:"https://official.test",attachments:[],caseNumbers:[id]}))}]};
 const metrics=locationMetrics(snapshot);expect(metrics).toEqual({geometryMatchRate:.5,applicationsWithoutGeometry:2,applicationsWithoutAddress:1,agendaItemsWithoutMatchedLocation:3});
 const report:QaReport={id:"fixture",snapshotHash:"fixture",areaId:"fixture",createdAt:"2026-10-28",passed:false,checks:[],data:{...metrics,projectedMonthlyUsd:{low:0,high:0,basis:"fixture"}}},markdown=reportMarkdown(report);
 expect(markdown).toContain("| Application geometry rate | 50.0% |");expect(markdown).toContain("| Applications without geometry | 2 |");expect(markdown).toContain("| Applications without address | 1 |");expect(markdown).toContain("| Agenda items without matched geometry/address | 3 |");
});
