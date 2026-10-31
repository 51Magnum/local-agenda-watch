import {expect,it} from "vitest";
import {jurisdiction} from "./registry";
import {selfCheck,type LinkEvidence} from "./self-check";
import {verificationUrl,restrictedRecordData} from "./record-links";
import {applicationRecordUrl} from "./application-source";
import type {Application,Attachment} from "./adapters/types";
import type {StagingSnapshot} from "./store";
const d={...jurisdiction("ada-county"),selfCheck:{minPassRate:.95},applications:{...jurisdiction("ada-county").applications,recordUrlTemplate:"https://official.test/tracker?find={recordId}"},recordLinks:{kind:"jsApp" as const,idField:"APPFILE",verifyUrlTemplate:"https://official.test/data?recordId={recordId}&outFields=APPFILE,AppApplicDesc&f=json",dataFields:["APPFILE","AppApplicDesc"],dataLabel:"County records (data)"},documents:{...jurisdiction("ada-county").documents,officialPaths:[{host:"official.test",pathname:"/documents"}]}};
const app=(recordId="202600934-S"):Application=>({recordId,sourceRowCount:1,projectNumber:recordId.split("-")[0],relatedCaseNumbers:[],name:"Contractor yard",description:"Conditional Use for a contractor yard",type:"Conditional Use",status:"Active",address:"",parcel:[],sourceFields:{APPFILE:recordId,APPLICANT:"Smith, Jane",AppApplicDesc:"Conditional Use for a contractor yard"},recordUrl:applicationRecordUrl(d,recordId),sourceUrl:applicationRecordUrl(d,recordId)});
const snapshot=(applications=[app()],attachments:Attachment[]=[]):StagingSnapshot=>({areaId:d.id,launchStatus:"admin_only",checkedAt:"2026-10-31",range:{start:"2026-08-01",end:"2026-11-01"},complete:true,health:[],skipped:[],applications,meetings:attachments.length?[{id:"one",body:"pzc",title:"PZC",date:"2026-10-15",meetingPageUrl:"https://official.test/agenda",attachments:[],items:[{itemId:"1",title:"Hearing",caseNumbers:applications.map(a=>a.recordId),body:"pzc",meetingDateTime:"2026-10-15",meetingPageUrl:"https://official.test/agenda",attachments}]}]:[]});
const evidence=async(url:string):Promise<LinkEvidence>=>{const u=new URL(url),id=u.searchParams.get("recordId");return {status:200,text:id?JSON.stringify({features:[{attributes:{APPFILE:id,AppApplicDesc:"Contractor yard"}}]}):u.pathname==="/tracker"?"JavaScript application shell":"202600934 202600273 Jane Smith mailto:planner@county.gov"};};
const staff:Attachment={title:"Staff report",kind:"staff_report",url:"https://official.test/documents?doc=202600934-STAFF_REPORT.pdf"};
it("verifies a JavaScript tracker against exactly one full APPFILE and restricted JSON fields",async()=>{
 const r=await selfCheck(d,snapshot(),{links:evidence});expect(r.goLive).toBe(true);
 const url=verificationUrl(d,app().recordId)!;
 expect(restrictedRecordData(d,url,JSON.stringify({features:[{attributes:{APPFILE:app().recordId,APPLICANT:"Jane Smith"}}]}),app().recordId)).toBe(false);
 for(const features of [[],[{attributes:{APPFILE:"wrong"}}],[{attributes:{APPFILE:app().recordId}},{attributes:{APPFILE:app().recordId}}]])expect(restrictedRecordData(d,url,JSON.stringify({features}),app().recordId)).toBe(false);
});
it("allows county staff reports naming applicants and staff without privacyReviewed",async()=>{
 const r=await selfCheck(d,snapshot([app()],[staff]),{links:evidence});expect(r.records[0].publish).toBe(true);expect(r.queue).toEqual([]);
});
it("rejects individual identity copied into LAW text",async()=>{
 const a=app();a.description="Conditional Use for Jane Smith";a.sourceFields.AppApplicDesc=a.description;
 expect((await selfCheck(d,snapshot([a]),{links:evidence})).counts.privacy.fail).toBe(1);
});
it("hides and queues an individual applicant letter or unclassified attachment",async()=>{
 for(const kind of ["letter","other"] as const){const r=await selfCheck(d,snapshot([app()],[{title:kind==="other"?"Official attachment":"Applicant letter",kind,url:"https://official.test/documents?doc=202600934-"+kind+".pdf"}]),{links:evidence});expect(r.counts.privacy.fail).toBe(1);expect(r.records[0].publish).toBe(false);}
});
it("accepts a shared document for both projects on the same agenda item",async()=>{
 const r=await selfCheck(d,snapshot([app("202600273-ZC"),app("202400171-CPA")],[{...staff,url:"https://official.test/documents?doc=202600273-STAFF_REPORT.pdf"}]),{links:evidence});expect(r.records.every(r=>r.publish)).toBe(true);
});
it("keeps unreadable PDFs uncertain and scheduled for retry, outside the owner queue",async()=>{
 const r=await selfCheck(d,snapshot([app()],[staff]),{links:async url=>url===staff.url?{status:200,text:"",readable:false}:evidence(url)});
 expect(r.counts["link-resolves-to-case"].uncertain).toBe(1);expect(r.queue).toEqual([]);expect(r.goLive).toBe(false);
});
it("uses a configured official filename as identity evidence, never an unrelated host",async()=>{
 const r=await selfCheck(d,snapshot([app()],[staff]),{links:async url=>url===staff.url?{status:200,text:"Front matter without a case number"}:evidence(url)});expect(r.records[0].publish).toBe(true);
 const copy={...staff,url:staff.url.replace("official.test","untrusted.test")};expect((await selfCheck(d,snapshot([app()],[copy]),{links:async url=>url===copy.url?{status:200,text:"Unrelated report"}:evidence(url)})).records[0].publish).toBe(false);
});
it("verifies a legacy case only from one exact source row without conflicting aliases",async()=>{
 const a={...app("03006-CU"),projectNumber:"200300068"};expect((await selfCheck(d,snapshot([a]),{links:evidence})).counts["case-identity"].pass).toBe(1);
 a.sourceRowCount=2;expect((await selfCheck(d,snapshot([a]),{links:evidence})).counts["case-identity"].uncertain).toBe(1);
 a.sourceRowCount=1;a.relatedCaseNumbers=["202600934-S"];expect((await selfCheck(d,snapshot([a]),{links:evidence})).counts["case-identity"].fail).toBe(1);
});

it.each(["Jane Smith","planner@county.gov"])("rejects private identity/contact copied into LAW URL queries: %s",async value=>{
 const a=app();a.recordUrl+="&contact="+encodeURIComponent(value);const r=await selfCheck(d,snapshot([a]),{links:evidence});expect(r.counts.privacy.fail).toBe(1);
});
