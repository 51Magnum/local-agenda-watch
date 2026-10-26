import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { agendaCaseCopy } from "./agenda-case-copy";
import { parseMunicipalAgenda } from "./sources/municipal";
import type { Hearing, HearingFeed } from "./localities/types";
const now = new Date("2026-10-26T18:00:00Z");
const meeting = {body:"City Council",bodyLabel:"City Council",date:"2026-10-27",dateLabel:"Oct 27",sourceUrl:"https://official.gov/agenda",continuedNote:null};
it("uses Quarry Village's exact agenda request instead of the older Costco GIS name", () => {
  const items = parseMunicipalAgenda(readFileSync("lib/sources/fixtures/eagle-agenda.txt","utf8"),"eagle",meeting.sourceUrl);
  const feed = {active:[{appId:"RZDA-2020-05-MOD1",displayTitle:"Costco Wholesale",meetings:[meeting]} as Hearing],completed:[],agendaMeetings:[{...meeting,id:"council",title:"Council",items}]} satisfies HearingFeed;
  const copy = agendaCaseCopy(feed,"RZDA-2020-05-MOD1",undefined,now)!;
  expect(copy.name).toBe("Quarry Village");
  expect(copy.headline).toContain("5-year development agreement extension to July 19, 2031");
  expect(copy.explanation).toContain("by 5 years");
  expect(copy.where).toBe("the north side of Hill Road between State Highway 55 and North Horseshoe Bend Road");
  expect(JSON.stringify(copy)).not.toMatch(/Costco|zoning rules/);
  expect(copy.sourceUrl).toBe(meeting.sourceUrl);
});
it("uses the current Thruston Choi notice's lots, acreage and industrial zone", () => {
  const description="Thruston Choi Farms Subdivision H-2026-0053: For a Preliminary Plat to subdivide two (2) existing parcels into six (6) buildable lots in the I-L zoning district on 22.26 acres of land, located at 5201 and 5035 W. Franklin Rd. Applicant: The Land Group";
  const h={appId:"H-2026-0053",displayTitle:"An older site title",description,meetings:[meeting]} as Hearing;
  const copy=agendaCaseCopy({active:[h],completed:[]},h.appId,undefined,now)!;
  expect(copy.name).toBe("Thruston Choi Farms Subdivision");
  expect(copy.headline).toBe("6 buildable lots on 22.26 acres in the I-L light industrial zone");
  expect(copy.explanation).not.toContain("Applicant");
  expect(copy.where).toBe("5201 and 5035 W. Franklin Rd");
});
it("does not use another case's agenda text or a past agenda", () => {
  const item={title:"RZDA-2020-05-MOD1 Quarry Village",caseIds:["RZDA-2020-05-MOD1"],agendaUrl:meeting.sourceUrl,staffReports:[]};
  const feed={active:[],completed:[],agendaMeetings:[{...meeting,id:"1",title:"Council",items:[item]}]};
  expect(agendaCaseCopy(feed,"RZDA-2020-05",undefined,now)).toBeUndefined();
  expect(agendaCaseCopy(feed,item.caseIds[0],undefined,new Date("2026-11-01T12:00:00Z"))).toBeUndefined();
});
it("does not re-associate a reference withheld by the source adapter", () => {
  const feed={active:[{appId:"DA-26-03",meetings:[{...meeting,date:"2026-11-03"}]} as Hearing],completed:[],agendaMeetings:[{...meeting,id:"1",title:"Council",items:[{title:"Another site's related DA-26-03",caseIds:["DA-26-03"],agendaUrl:meeting.sourceUrl,staffReports:[]}]}]};
  expect(agendaCaseCopy(feed,"DA-26-03",undefined,now)).toBeUndefined();
});
it("keeps mixed-case case numbers and staff names out of Kuna's resident copy",()=>{
 const id="26-03-ZC",h={appId:id,displayTitle:"Perry's Place",meetings:[meeting]} as Hearing;
 const title="Case No. 26-03-ZC & 26-01-CPA, Perry’s Place – Marina Lundy – Associate Planner. A zone change from R-6 to C-2 at Kay Ave and E 4th St.";
 const copy=agendaCaseCopy({active:[h],completed:[],agendaMeetings:[{...meeting,id:"1",title:"Council",items:[{title,caseIds:[id],agendaUrl:meeting.sourceUrl,staffReports:[]}]}]},id,undefined,now)!;
 expect(copy.name).toBe("Perry's Place");expect(copy.headline).toContain("change zoning from R-6 to C-2");expect(JSON.stringify(copy)).not.toMatch(/Marina|Lundy|Case No|26-03/);
});
it("summarizes the current Nampa request without copying legal descriptions or an old concept",()=>{
 const id="ANN-00361-2026",h={appId:id,displayTitle:"Annexation and zoning",meetings:[meeting]} as Hearing;
 const title="Annexation & zoning with a development agreement and Master Planned Community for Whitewater, on 3 parcels, for an applicant (ann-00361-2026). Original Concept: 900 residential lots.";
 const copy=agendaCaseCopy({active:[h],completed:[],agendaMeetings:[{...meeting,id:"1",title:"Council",items:[{title,caseIds:[id],agendaUrl:meeting.sourceUrl,staffReports:[]}]}]},id,undefined,now)!;
 expect(copy.name).toBe("Whitewater");expect(copy.headline).toBe("Whitewater: annexation and zoning for a master-planned community");expect(JSON.stringify(copy)).not.toMatch(/parcels|applicant|900|ann-00361/);
});
it("keeps the same Ridgeside name for each jointly heard case number",()=>{
 const items=parseMunicipalAgenda(readFileSync("lib/sources/fixtures/eagle-agenda.txt","utf8"),"eagle",meeting.sourceUrl);
 for(const id of ["RZDA-2026-03","PP-2026-03","CUP-2026-08","PPUD-2026-03"]){
  const copy=agendaCaseCopy({active:[{appId:id,displayTitle:"Ridgeside Subdivision",meetings:[meeting]} as Hearing],completed:[],agendaMeetings:[{...meeting,id:"1",title:"Council",items}]},id,undefined,now)!;
  expect(copy.name).toBe("Ridgeside Subdivision");expect(copy.headline).toContain("20 residential lots in a 28-lot subdivision");
 }
});
