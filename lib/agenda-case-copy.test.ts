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
