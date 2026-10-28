import {expect,it} from "vitest";
import {stagedFeed,stagedMapSnapshot} from "./resident-records";
import {jurisdiction} from "./registry";
import type {StagingSnapshot} from "./store";
const snapshot:StagingSnapshot={areaId:"ada-county",launchStatus:"admin_only",checkedAt:"2026-10-28T14:00:00Z",range:{start:"2026-08-01",end:"2026-12-01"},complete:true,health:[],skipped:[],applications:[{recordId:"202601398-CU-MSP",relatedCaseNumbers:[],name:"Proposed storage building",type:"",status:"A",address:"",parcel:["R123456"],description:"A proposed storage building.",received:"2026-09-01",recordUrl:"https://gisprod.adacounty.id.gov/apps/application_tracker/",sourceUrl:"https://gisprodapi.adacounty.id.gov/arcgis/rest/services/DevelopmentServices/Planning_and_Building/MapServer/14",sourceFields:{APTDescription:"CONDITIONAL USE",STATUS:"Active"},geometry:{type:"Polygon",coordinates:[[[-116.4,43.5],[-116.39,43.5],[-116.39,43.51],[-116.4,43.5]]]}}],meetings:[{id:"pzc:2026-10-15",body:"pzc",title:"Planning and Zoning Commission",date:"2026-10-15",meetingPageUrl:"https://apps.adacounty.id.gov/AdaFileBrowse/agenda.pdf",attachments:[],items:[{itemId:"one",title:"202601398-CU-MSP",caseNumbers:["202601398-CU-MSP"],body:"pzc",meetingDateTime:"2026-10-15",meetingPageUrl:"https://apps.adacounty.id.gov/AdaFileBrowse/agenda.pdf",attachments:[]}]}]};
it("shows readable source status, dated source hearings and document records without inventing outcomes or hearing times",()=>{
 const feed=stagedFeed(jurisdiction("ada-county"),snapshot),h=feed.active[0];
 expect(h.appType).toBe("CONDITIONAL USE");expect(h.appStatus).toBe("Active");expect(h.meetings[0].time).toBeUndefined();
 const record=(h as import("./resident-records").ConfiguredHearing).record;
 expect(record.appliedDate).toBe("2026-09-01");expect(record.events[0].startsAt).toBe("2026-10-15");expect(record.events[0].result).toBeUndefined();expect(record.events[0].sourceUrl).toContain("agenda.pdf");
});
it("maps only the staged, verified polygons and uses resident links",()=>{
 const map=stagedMapSnapshot(jurisdiction("ada-county"),snapshot);
 expect(map.cases).toHaveLength(1);expect(map.cases[0].geometry).toEqual(snapshot.applications[0].geometry);expect(map.cases[0].href).toBe("/us/id/ada-county/plan/202601398-CU-MSP");expect(map.cases[0].recordStatus).toBe("Active");
});
