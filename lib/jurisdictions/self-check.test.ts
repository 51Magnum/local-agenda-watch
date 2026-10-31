import {expect,it,vi,afterEach} from "vitest";
import {selfCheck,titleFromSource,verifiedProposal} from "./self-check";
import {jurisdiction} from "./registry";
import {groupApplications} from "./application-groups";
import {applicationScope} from "./application-scope";
import {accountForAgenda,assertCollectionComplete} from "./agenda-projects";
import {jurisdictionToday,projectHearingState} from "./hearing-state";
import {applicationTitle,primaryType} from "./application-copy";
import {databaseUrl,requireOnboardingMutation} from "../runtime-environment";
import {validateJurisdictions} from "./validate";
import type {Application,AgendaItem} from "./adapters/types";
import type {StagingSnapshot} from "./store";
const d={...jurisdiction("ada-county"),selfCheck:{minPassRate:.95}};
const app=(id:string,description="Conditional Use for a contractor yard"):Application=>({recordId:id,projectNumber:id.split("-")[0],relatedCaseNumbers:[],type:"Conditional Use",description,name:description,status:"Active",address:"",parcel:[],recordUrl:"https://official.test/"+id,sourceUrl:"https://official.test/"+id,sourceFields:{AppApplicDesc:description,APPLICANT:"Development LLC"}});
const item=(ids:string[]):AgendaItem=>({itemId:ids.join("&"),title:"Conditional Use for a contractor yard",caseNumbers:ids,body:"bocc",meetingDateTime:"2026-10-14",meetingPageUrl:"https://official.test/agenda",attachments:[]});
const snapshot=(apps:Application[],items:AgendaItem[]=[]):StagingSnapshot=>({areaId:d.id,launchStatus:"admin_only",checkedAt:"2026-10-31T12:00:00Z",range:{start:"2026-08-01",end:"2026-12-01"},complete:true,health:[],skipped:[],applications:apps,meetings:items.length?[{id:"bocc",body:"bocc",title:"Board of County Commissioners",date:"2026-10-14",meetingPageUrl:"https://official.test/agenda",attachments:[],items}]:[]});
const links=async()=>({status:200,text:"202502399 202502461 202600829 202600864 202600934 202600273 202400171 202601712 202102022",privacyReviewed:true});
afterEach(()=>vi.unstubAllEnvs());
it.each([["202502399",["PR"]],["202502461",["CU","MSP"]]] as [string,string[]][])("accounts for appeal %s by project number",(number,suffixes)=>{
 const s=snapshot(groupApplications(d,suffixes.map(s=>app(number+"-"+s))),[item([number+"-A"])]);accountForAgenda(d,s);
 expect(s.applications).toHaveLength(1);expect(s.applications[0].relatedCaseNumbers).toContain(number+"-A");expect(s.meetings[0].items[0].matchedApplications).toHaveLength(1);
});
it("retains both missing GIS cases as agenda-only source projects",async()=>{
 const s=snapshot([],[item(["202600829-VAC-PCON-PBA"]),item(["202600864-CU-MSP"])]);accountForAgenda(d,s);
 expect(s.applications.every(a=>a.agendaOnly&&!a.geometry&&!a.address)).toBe(true);
 const r=await selfCheck(d,s,{links});expect(r.unmatched).toEqual([]);expect(r.coverage[0].status).toBe("pass");expect(r.records.every(r=>r.publish)).toBe(true);
});
it("keeps shared-hearing project identities separate",async()=>{
 const s=snapshot([app("202600273-ZC-S-PUD-MSP-PR-HD-ALT"),app("202400171-CPA")],[item(["202600273-ZC-S-PUD-MSP-PR-HD-ALT","202400171-DA-DM"])]);accountForAgenda(d,s);
 expect(s.applications[0].relatedCaseNumbers).not.toContain("202400171-DA-DM");expect(s.applications[1].relatedCaseNumbers).toContain("202400171-DA-DM");
 s.applications[0].relatedCaseNumbers.push("202400171-CPA");const r=await selfCheck(d,s,{links});expect(r.records[0].checks.find(c=>c.check==="case-identity")?.status).toBe("fail");
});
it("does not redact an organization hearing case because it mentions a home occupation",()=>{
 const a=app("202600934-S","Two-lot subdivision with a home occupation detail");expect(applicationScope(d,[a],[])[0].residentialPrivacy).toBe(false);
});
it.each(["202601712-COM","202102022-MSP"])("includes organization development %s",id=>expect(applicationScope(d,[app(id)],[])).toHaveLength(1));
it("counts and excludes 37 homeowner Accessory Use permits",()=>{
 const apps=Array.from({length:37},(_,i)=>({...app(String(202600000+i)+"-AC"),sourceFields:{APPLICANT:"Smith, Jane"}}));expect(apps.length-applicationScope(d,apps,[]).length).toBe(37);
});
it("selects the significant type, never the alphabetical suffix",()=>{
 const rows=[{...app("202600273-ALT"),type:"Alternative Compliance"},{...app("202600273-ZC","Zoning Map Amendment for Bellarossa Subdivision with 175 lots"),type:"Zoning Map Amendment"}];
 const a=groupApplications(d,rows)[0];expect(a.recordId).toBe("202600273-ZC");const title=applicationTitle(primaryType(a),a.description);expect(title).toMatch(/^Zoning Map Amendment:/);expect(title).not.toContain("…");expect(titleFromSource(title,a)).toBe(true);
});
it("rejects raw links even when they identify the case",async()=>{
 const a=app("202600934-S");a.recordUrl+="?f=pjson";const r=await selfCheck(d,snapshot([a]),{links});expect(r.records[0].publish).toBe(false);expect(r.counts["link-resolves-to-case"].fail).toBe(1);
});
it("fails closed on unverified source links and incomplete privacy reviews",async()=>{
 const s=snapshot([app("202600934-S")],[item(["202600934-S"])]);s.meetings[0].items[0].attachments=[{title:"Staff report",url:"https://official.test/report.pdf",kind:"staff_report"}];accountForAgenda(d,s);
 const r=await selfCheck(d,s,{links:async()=>({status:200,text:"202600934"})});expect(r.records[0].publish).toBe(false);expect(r.counts.privacy.uncertain).toBe(1);
});
it("blocks incomplete and sharply diminished collections before staging replacement",()=>{
 const old=snapshot([app("202600934-S")],[item(["202600934-S"])]);accountForAgenda(d,old);
 expect(()=>assertCollectionComplete({...old,complete:false},old)).toThrow("incomplete");expect(()=>assertCollectionComplete(snapshot([]),old)).toThrow("30%");
});
it("uses Boise's date at 9 PM and ignores tentative project hearings",()=>{
 expect(jurisdictionToday(d.timezone,new Date("2026-10-15T03:00:00Z"))).toBe("2026-10-14");
 const s=snapshot([],[item(["202600934-S"])]);s.meetings[0].tentative=true;expect(projectHearingState(d,s.meetings,s.checkedAt,"2026-10-14").next).toBeUndefined();
});
it("requires a separate preview host, including pooled Neon aliases",()=>{
 vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("DATABASE_URL","postgres://user:secret@ep-main.neon.tech/db");vi.stubEnv("DATABASE_URL_PREVIEW","");expect(()=>databaseUrl()).toThrow("required");
 vi.stubEnv("DATABASE_URL_PREVIEW","postgres://reader:secret@ep-main-pooler.neon.tech/db");expect(()=>databaseUrl()).toThrow("matches production");
 vi.stubEnv("DATABASE_URL_PREVIEW","postgres://reader:secret@ep-preview.neon.tech/db");expect(databaseUrl()).toContain("ep-preview");
 expect(()=>requireOnboardingMutation()).toThrow("disabled");vi.stubEnv("LAW_DB_TARGET","preview");vi.stubEnv("DATABASE_BRANCH_ID","br-main");vi.stubEnv("DATABASE_PREVIEW_BRANCH_ID","br-preview");expect(()=>requireOnboardingMutation()).not.toThrow();
 vi.stubEnv("DATABASE_PREVIEW_BRANCH_ID","br-main");expect(()=>databaseUrl()).toThrow("branch matches");
});
it("refuses forged JSON launch approval",()=>{
 expect(()=>validateJurisdictions([{...d,launchStatus:"public",publication:{approvalId:"fake",qaHash:"fake"}}])).toThrow("recorded approval");
});
it("auto-applies only source-verifiable title or additional hiding proposals",()=>{
 const a=app("202600934-S");expect(verifiedProposal(a,{title:"Contractor yard",reason:"Source words",aiGenerated:true,sourceUrls:[a.sourceUrl]})).toBe(true);
 expect(verifiedProposal(a,{title:"Approved new school",reason:"Invented",aiGenerated:true,sourceUrls:[a.sourceUrl]})).toBe(false);
 const b={...a,description:"Previously approved shop; proposed new use"};expect(verifiedProposal(b,{title:"Approved new shop",reason:"Reordered words invent an outcome",aiGenerated:true,sourceUrls:[b.sourceUrl]})).toBe(false);
});
it("keeps decisions only while application and linked source text remain unchanged",async()=>{
 const s=snapshot([app("202600934-S")]),first=await selfCheck(d,s,{links});const decisions=[{areaId:d.id,recordId:s.applications[0].recordId,sourceHash:first.records[0].sourceHash,action:"hide" as const,reviewer:"admin"}];
 expect((await selfCheck(d,s,{links,decisions})).records[0].publish).toBe(false);
 expect((await selfCheck(d,s,{links:async()=>({status:200,text:"202600934 revised source"}),decisions})).records[0].publish).toBe(true);
});
