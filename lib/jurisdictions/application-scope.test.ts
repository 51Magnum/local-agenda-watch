import {expect,it,vi} from "vitest";
import {applicationScope,individualApplicant} from "./application-scope";
import {jurisdiction} from "./registry";
import {stagedFeed,stagedMapSnapshot} from "./resident-records";
import type {Application} from "./adapters/types";
import type {StagingSnapshot} from "./store";
const d=jurisdiction("ada-county");
it.each(["Smith, Jane","Jane Smith","SMITH, JOHN A."])("recognizes individual %s",v=>expect(individualApplicant(v)).toBe(true));
it.each(["Jane Smith LLC","Smith Inc","Smith Family Trust","Ada County","City of Boise","Idaho Department of Lands",""])("excludes organization or unknown %s",v=>expect(individualApplicant(v)).toBe(false));
const app=(id:string):Application=>({recordId:id,relatedCaseNumbers:[],name:"Jane Smith at 123 Main Street",description:"Jane Smith requests an accessory permit at 123 Main Street",address:"123 Main Street",type:"Accessory use",status:"Active",parcel:["R123456"],sourceUrl:"https://official.test/query",recordUrl:"https://official.test/query",sourceFields:{APPLICANT:"Smith, Jane"},geometry:{type:"Polygon",coordinates:[[[-116.5,43.5],[-116.49,43.5],[-116.49,43.51],[-116.5,43.5]]]}});
const snapshot:StagingSnapshot={areaId:d.id,launchStatus:"admin_only",checkedAt:"2026-10-28T00:00:00Z",range:{start:"2026-08-01",end:"2026-12-01"},complete:true,health:[],skipped:[],applications:[app("202601455-AC")],meetings:[{id:"pzc",title:"PZC",body:"pzc",date:"2026-10-15",meetingPageUrl:"https://official.test/agenda",attachments:[],items:[{itemId:"1",title:"Source item",caseNumbers:["202601455-AC"],body:"pzc",meetingDateTime:"2026-10-15",meetingPageUrl:"https://official.test/agenda",attachments:[]}]}]};
it("excludes staff permits by default, retaining hearing types and agenda-linked staff items",()=>{
 expect(applicationScope(d,[app("202601455-AC"),app("202601456-CU")],[]).map(a=>a.recordId)).toEqual(["202601456-CU"]);
 expect(applicationScope(d,snapshot.applications,snapshot.meetings)[0].residentialPrivacy).toBe(true);
});
it("removes exact parcel, street number and private identity from resident feed and map",()=>{
 const feed=stagedFeed(d,snapshot),map=stagedMapSnapshot(d,snapshot),text=JSON.stringify({feed,map});
 expect(text).not.toMatch(/Jane|Smith|123 Main|R123456/);
 expect(map.cases[0].confidence).toBe("approximate");expect(map.cases[0].parcelIds).toBeUndefined();
 expect(map.cases[0].geometry).not.toEqual(snapshot.applications[0].geometry);
});
it("protects the full resident page for an individual staff permit",async()=>{
 vi.doMock("./store",()=>({readStaging:async()=>snapshot}));
 vi.doMock("../timeline/store",()=>({getEvidenceStore:()=>({read:async()=>({documents:{},fields:{},runs:[]})})}));
 vi.doMock("../areas/registry",()=>({getArea:()=>({...d.area,id:d.id,name:d.name}),areaPath:()=>"/us/id/ada-county"}));
 vi.doMock("../residential-privacy-store",()=>({privacyOverrides:async()=>({})}));
 const {residentProject}=await import("./resident-project"),page=await residentProject(d.id,"202601455-AC");
 expect(page?.item.residentialPrivacy).toBe(true);expect(JSON.stringify(page)).not.toMatch(/Jane|Smith|123 Main|R123456/);
});
