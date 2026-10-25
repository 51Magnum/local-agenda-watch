import {caseReportPages} from "./timeline/report-pages";
import {expect,it,vi,afterEach} from "vitest";
import {cleanResidentTitle,readableLocation,cleanResidentProse} from "./resident-copy";
import {hearingDateTime} from "./areas/format";
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
it("cleans official boilerplate without inventing facts or exposing parcel-only locations",()=>{
 expect(cleanResidentTitle("ACTION ITEM: WINCO WELLS final plat H-2026-0047 Checklist")).toBe("Winco Wells Final Plat");
 expect(readableLocation("0,0,0")).toBeUndefined();expect(readableLocation("Parcel R3066500000")).toBeUndefined();expect(readableLocation("0 SOUTHSIDE BLVD Nampa ID")).toBe("SOUTHSIDE BLVD Nampa ID");
 expect(cleanResidentProse("Canyon County .")).toBe("Canyon County.");
});
it("formats hearing dates identically in summer, winter and date-only records",()=>{
 expect(hearingDateTime("2026-10-28T00:00:00Z")).toBe("Tue, Oct 27, 2026 · 6 PM Mountain Time");
 expect(hearingDateTime("2026-12-16T01:00:00Z")).toBe("Tue, Dec 15, 2026 · 6 PM Mountain Time");
 expect(hearingDateTime("2026-11-19")).toBe("Thu, Nov 19, 2026");
});

it("preserves official mixed-case names and zoning codes",()=>{expect(cleanResidentTitle("WinCo Wells final plat")).toBe("WinCo Wells Final Plat");expect(cleanResidentTitle("MU-RG")).toBe("MU-RG");});

it("isolates a case's physical packet pages and ignores a multi-case table of contents",()=>{
 const pages=[{page:1,text:"H-2026-0001 H-2026-0002 H-2026-0003 H-2026-0004",method:"native" as const},{page:2,text:"H-2026-0002 staff report",method:"native" as const},{page:3,text:"Proposed site layout",method:"native" as const},{page:4,text:"H-2026-0003 other case",method:"native" as const}];
 expect(caseReportPages(pages,"H-2026-0002",true).map(p=>p.page)).toEqual([2,3]);
});

it("recognizes Kuna and Star packet section identifiers",()=>{
 for(const id of ["26-03-ZC","AZ-26-095"]){const pages=[{page:60,text:id+" STAFF REPORT",method:"native" as const},{page:61,text:"Proposed plan",method:"native" as const},{page:62,text:"H-2026-0099 another project",method:"native" as const}];expect(caseReportPages(pages,id,true).map(p=>p.page)).toEqual([60,61]);}
});
