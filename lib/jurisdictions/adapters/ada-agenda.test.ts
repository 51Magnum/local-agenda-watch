import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {jurisdiction} from "../registry";
import {parseAdaFiles,adaMeetings} from "./ada-file-browse";
import {parseAdaAgenda,adaDocumentCases} from "./ada-agenda";
const fixture=(name:string)=>readFileSync(new URL("../fixtures/"+name,import.meta.url),"utf8"),d=jurisdiction("ada-county");
it.each([["pzc","2026-10-15","ada-pzc-2026-10-15.txt"],["bocc","2026-10-14","ada-bocc-2026-10-14.txt"]])("parses recorded %s agenda text and human attachment labels",(body,date,file)=>{
 const listed=adaMeetings(parseAdaFiles(fixture("ada-file-tree.html")),d,d.agenda[0]).find(m=>m.body===body&&m.date===date)!;
 expect(listed.items).toEqual([]);
 const parsed=parseAdaAgenda(fixture(file),listed,d);
 expect(parsed.startsAt).toBe(date==="2026-10-15"?"2026-10-16T00:00:00.000Z":"2026-10-15T00:00:00.000Z");
 expect(parsed.items).toHaveLength(7);
 for(const i of parsed.items){expect(i.title).not.toMatch(/\.pdf$|-(MEMO|FINDINGS|STAFF_REPORT|PZC)$/i);expect(i.caseNumbers.join(" ")).not.toMatch(/\.pdf|MEMO|FINDINGS|STAFF_REPORT|PZC/i);expect(i.title).not.toContain("APPLICANT WITHHELD");}
 const id=body==="pzc"?"202601398-CU-MSP":"202601614-VAC-PCON",item=parsed.items.find(i=>i.caseNumbers.includes(id))!;
 expect(item.title).toMatch(body==="pzc"?/Contractor's Yard/i:/parcel consolidation/i);
 expect(item.staffRecommendation).toBe("Approval");
 expect(item.attachments.map(a=>a.title)).toContain("Staff report");
 expect(item.attachments.every(a=>!a.title.endsWith(".pdf"))).toBe(true);
 expect(parsed.items[0].tabledNote).toContain("Tabled from");
 expect(parsed.items[0].bodyRecommendation).toBe(body==="pzc"?"Denial":"Approval");
});
it.each(["05-PZC-202601398-CU-MSP-MEMO.pdf","05-PZC-202601398-CU-MSP-STAFF_REPORT.pdf","05-PZC-202601398-CU-MSP-FINDINGS.pdf","202601398-CU-MSP-PZC.pdf"])("never appends document suffixes to %s",file=>expect(adaDocumentCases(file)).toEqual(["202601398-CU-MSP"]));
it("does not retain individual header applicants and tracks the physical page",()=>{
 const m={id:"test",body:"pzc",title:"PZC",date:"2026-11-19",meetingPageUrl:"https://official.test/agenda.pdf",items:[],attachments:[]};
 const parsed=parseAdaAgenda("Cover\f\n1. 202601398-CU-MSP, JANE SMITH\nA contractor yard.\nStaff Recommendation: Approval",m,d);
 expect(JSON.stringify(parsed)).not.toContain("JANE SMITH");expect(parsed.items[0].sourcePage).toBe(2);expect(parsed.items[0].itemUrl).toMatch(/#page=2$/);
});
