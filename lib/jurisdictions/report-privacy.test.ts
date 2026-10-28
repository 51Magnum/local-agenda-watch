import {readFileSync,statSync} from "node:fs";
import {expect,it} from "vitest";
import {redactQaReport} from "./report-privacy";
import {reportMarkdown} from "./report";
import type {QaReport} from "./store";
it("omits candidate names, prose, quotes and rosters while preserving counts, spend and source-page metadata",()=>{
 const report:QaReport={id:"qa",areaId:"ada-county",createdAt:"2026-10-28",snapshotHash:"hash",passed:false,checks:[],data:{applications:81,spentUsd:.0282872,projectedMonthlyUsd:{low:0,high:2,basis:"fixture"},aiSamples:[{caseId:"202601398-CU",sourceUrl:"https://official.test/report.pdf",hash:"hash",pageCount:2,costUsd:.01,tokens:100,privateNote:"Jane Smith",fields:[{key:"applicantCompany",value:"Jane Smith",quote:"Jane Smith applied",speakers:[{name:"Jane Smith"}],page:2,status:"pending",sourceUrl:"https://official.test/report.pdf"}]}]}};
 const safe=redactQaReport(report);expect(JSON.stringify(safe)).not.toContain("Jane Smith");expect(reportMarkdown(report)).not.toContain("Jane Smith");expect(safe.data.applications).toBe(81);expect(safe.data.spentUsd).toBe(.0282872);
 expect((safe.data.aiSamples as {fields:unknown[]}[])[0].fields[0]).toMatchObject({key:"applicantCompany",page:2,status:"pending",sourceUrl:"https://official.test/report.pdf"});
 expect((report.data.aiSamples as {fields:{value:string}[]}[])[0].fields[0].value).toBe("Jane Smith");
});
it("keeps the recorded eSCRIBE fixture small, without hidden form state, with a matching trimmed provenance hash",async()=>{
 const file="lib/jurisdictions/fixtures/escribe-meeting.html",text=readFileSync(file,"utf8");expect(statSync(file).size).toBeLessThan(40000);expect(text).not.toMatch(/__VIEWSTATE|<script|<input/i);
 const {createHash}=await import("node:crypto"),provenance=JSON.parse(readFileSync("lib/jurisdictions/fixtures/provenance.json","utf8")).find((p:{file:string})=>p.file==="escribe-meeting.html");expect(provenance.hash).toBe(createHash("sha256").update(text).digest("hex"));expect(provenance.originalHash).toBeTruthy();
});
