import {expect,it} from "vitest";
import recorded from "./fixtures/ada-selfcheck-cases.json";
import {applicationFromFeature} from "./adapters/arcgis";
import {jurisdiction} from "./registry";
import {groupApplications} from "./application-groups";
import {applicationScope} from "./application-scope";
import {applicationTitle,primaryType} from "./application-copy";
import {parseAdaAgenda} from "./adapters/ada-agenda";
import {accountForAgenda} from "./agenda-projects";
import {readFileSync} from "node:fs";
import type {StagingSnapshot} from "./store";
import agendas from "./fixtures/ada-selfcheck-agendas.json";
import {selfCheck} from "./self-check";
const d=jurisdiction("ada-county"),apps=()=>groupApplications(d,recorded.rows.map(properties=>applicationFromFeature(d,{type:"Feature",geometry:null,properties})));
it.each(["202600273","202400171","202300644","202103209","202601864"])("uses source subject/type for recorded title %s",number=>{
 const a=apps().find(a=>a.projectNumber===number)!;expect(a).toBeDefined();const title=applicationTitle(primaryType(a),a.description);expect(title.length).toBeLessThanOrEqual(70);expect(title).not.toContain("…");expect(title).not.toMatch(/^Alternative Compliance: Alternative Compliance/i);
 if(number==="202600273")expect(title).toMatch(/^Zoning /i);
});
it("keeps recorded firm subdivision 202600934 public and the COM/MSP applications in scope",()=>{
 const retained=applicationScope(d,apps(),[]);
 for(const number of ["202600934","202601712","202102022"]){const a=retained.find(a=>a.projectNumber===number);expect(a,number).toBeDefined();expect(a?.residentialPrivacy).toBe(false);}
});
it("resolves the October 15 combined agenda case to the correct recorded project",()=>{
 const meeting=parseAdaAgenda(readFileSync(new URL("./fixtures/ada-pzc-2026-10-15.txt",import.meta.url),"utf8"),{id:"pzc",body:"pzc",title:"PZC",date:"2026-10-15",meetingPageUrl:"https://official.test/agenda.pdf",attachments:[],items:[]},d);
 const s:StagingSnapshot={areaId:d.id,launchStatus:"admin_only",applications:apps(),meetings:[meeting],checkedAt:"2026-10-31",range:{start:"2026-08-01",end:"2026-11-01"},health:[],skipped:[],complete:true};accountForAgenda(d,s);
 const own=s.applications.find(a=>a.relatedCaseNumbers.includes("202600273-ZC-S-PUD-MSP-PR-HD-ALT"));expect(own?.projectNumber).toBe("202600273");expect(own?.relatedCaseNumbers).not.toContain("202400171-DA-DM");
});
it("accounts for all 41 recorded hearing items, including both missing GIS projects",async()=>{
 const s:StagingSnapshot={areaId:d.id,launchStatus:"admin_only",applications:apps(),meetings:structuredClone(agendas.meetings),checkedAt:"2026-10-31",range:{start:"2026-08-02",end:"2026-11-01"},health:[],skipped:[],complete:true};accountForAgenda(d,s);
 const report=await selfCheck(d,s);expect(report.agendaItems).toEqual({accounted:41,total:41});expect(report.unmatched).toEqual([]);
 for(const number of ["202600829","202600864"])expect(s.applications.find(a=>a.projectNumber===number)?.agendaOnly).toBe(true);
 const appeal=s.applications.find(a=>a.projectNumber==="202502399")!;expect(appeal.agendaOnly).not.toBe(true);expect(appeal.relatedCaseNumbers).toContain("202502399-A");
 const dates=s.meetings.filter(m=>m.items.some(i=>i.matchedApplications?.some(a=>a.recordId===appeal.recordId))).map(m=>m.date);expect(dates).toEqual(expect.arrayContaining(["2026-08-12","2026-09-09","2026-10-14"]));
 const other=s.applications.find(a=>a.projectNumber==="202502461")!;expect(other.agendaOnly).not.toBe(true);expect(other.relatedCaseNumbers).toContain("202502461-A");
});
