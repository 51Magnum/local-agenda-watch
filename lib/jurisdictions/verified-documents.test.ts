import {expect,it} from "vitest";
import {jurisdiction} from "./registry";
import {selfCheck} from "./self-check";
import {publicationSnapshot} from "./self-check-store";
import {verifiedDocumentSnapshot,DOCUMENT_NOTICE} from "./verified-documents";
import {applicationRecordUrl} from "./application-source";
import {verificationUrl} from "./record-links";
import type {StagingSnapshot} from "./store";
const d=jurisdiction("boise"),id="PLN26-00001",meetingUrl="https://boisecityid.iqm2.com/Citizens/Detail_Meeting.aspx?ID=fixture",docUrl="https://pub-cityofboise.escribemeetings.com/FileStream.ashx?DocumentId=fixture";
const input=():StagingSnapshot=>({areaId:d.id,launchStatus:"admin_only",checkedAt:"2026-11-05",range:{start:"2026-08-01",end:"2026-12-20"},complete:true,health:[],skipped:[],applications:[{recordId:id,name:id,relatedCaseNumbers:[],type:"Conditional Use",description:"Construct a warehouse.",status:"In review",address:"",parcel:[],recordUrl:applicationRecordUrl(d,id),sourceUrl:applicationRecordUrl(d,id),sourceFields:{RecordID:id,ProjectType:"Conditional Use",Description:"Construct a warehouse."}}],meetings:[{id:"fixture",body:"pz",title:"Planning hearing",date:"2026-11-02",meetingPageUrl:meetingUrl,attachments:[],items:[{itemId:"1",title:"Planning application",caseNumbers:[id],body:"pz",meetingDateTime:"2026-11-02",meetingPageUrl:meetingUrl,matchedApplications:[{recordId:id,method:"case",sourceUrl:applicationRecordUrl(d,id)}],attachments:[{title:"Staff report",url:docUrl,kind:"staff_report"}]}]}]});
const evidence=(status=403,caseId=id)=>async(url:string)=>url===docUrl?{status,text:status===200?id:"",documentHash:status===200?"actual-pdf-hash":undefined}:url===verificationUrl(d,id)?{status:200,text:JSON.stringify({features:[{attributes:{RecordID:caseId}}]})}:{status:200,text:id};
it("publishes independently verified facts while withholding and queueing an inaccessible optional file",async()=>{
 const s=input(),r=await selfCheck(d,s,{links:evidence()});expect(r.goLive).toBe(true);expect(r.records[0].publish).toBe(true);expect(r.queue).toContainEqual(expect.objectContaining({check:expect.objectContaining({check:"document-verification"})}));
 const published=publicationSnapshot(s,r),preview=verifiedDocumentSnapshot(s,r);for(const p of [published,preview]){expect(p.meetings[0].items[0].attachments).toEqual([]);expect(p.applications[0].documentNotice).toBe(DOCUMENT_NOTICE);}expect(s.meetings[0].items[0].attachments).toHaveLength(1);
});
it("never substitutes an optional-file policy for exact case/agenda identity verification",async()=>{
 const s=input();expect((await selfCheck(d,s,{links:evidence(403,"WRONG-ID")})).goLive).toBe(false);
 const r=await selfCheck(d,s,{links:async url=>url===meetingUrl?{status:403,text:""}:evidence()(url)});expect(r.goLive).toBe(false);expect(r.records[0].withheldDocuments?.map(d=>d.url)).not.toContain(meetingUrl);
});
it("retains actual verified document hashes and keeps project identity stable across optional file availability",async()=>{
 const s=input(),blocked=await selfCheck(d,s,{links:evidence()}),verified=await selfCheck(d,s,{links:evidence(200)});
 expect(verified.records[0].sourceHash).toBe(blocked.records[0].sourceHash);expect(verified.records[0].verifiedDocuments?.[0].documentHash).toBe("actual-pdf-hash");expect(publicationSnapshot(s,verified).meetings[0].items[0].attachments[0].documentHash).toBe("actual-pdf-hash");
});
