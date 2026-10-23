import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { caseGroupingName, caseLocation, caseProjectOverview, safeProposalSummary } from "./case-project";
import { ProjectFacts, ProjectProposal } from "@/app/components/project-overview";
import { projectTimelineRows } from "./project-timeline";
import type { Hearing } from "./localities/types";
import type { EnerGovPlan } from "./sources/energov";
import type { TimelineData } from "./timeline/public";
import type { EvidenceField } from "./timeline/types";
const hearing:Hearing = {appId:"SPP-00999-2026",appType:"SPP",appTypeLabel:"Preliminary plat",appStatus:"Pending",appPhase:"Review",appPhaseRaw:"Review",appScope:"Business Park",appAcres:10,externalUrl:null,energovPlanId:null,meetings:[],description:"Commercial subdivision"};
const data:TimelineData={caseIds:[hearing.appId],fields:[],appearances:[],currentStage:"Under review",finalDecisionApproved:false};
const source="https://city.test/record";
function field(key:EvidenceField["key"],value:string,quote=value):EvidenceField{return{id:key,documentId:"report",documentHash:"hash",caseId:hearing.appId,key,value,quote,sourceUrl:"https://city.test/report.pdf",page:1,confidence:1,sourceKind:"staff-report",status:"auto_published",createdAt:"2026-10-01"};}
it("commercial plats show lots without claiming homes or housing density",()=>{
  const overview=caseProjectOverview(hearing,null,[],{...data,fields:[field("units","8","Eight commercial lots")]},source,false);
  const html=renderToStaticMarkup(createElement(ProjectFacts,{overview}));
  expect(overview.variant).toBe("subdivision");expect(html).toContain(">Lots<");expect(html).toContain(">8<");expect(html).not.toContain("homes/acre");expect(html).not.toContain("Homes / lots");
});
it("housing facts use document evidence and citywide changes omit site facts",()=>{
  const overview=caseProjectOverview({...hearing,description:"Single family residential subdivision"},null,[],{...data,fields:[field("units","35")]},source,false);
  expect(renderToStaticMarkup(createElement(ProjectFacts,{overview}))).toContain("~3.5 homes/acre");
  const citywide=caseProjectOverview({...hearing,appType:"ZTA",appTypeLabel:"Zoning text amendment"},null,[],{...data,fields:[field("units","35"),field("acres","10")]},source,true);
  expect(citywide.homes).toBeUndefined();expect(citywide.acres).toBeUndefined();expect(citywide.zoning).toBeUndefined();
});
it("does not reinterpret portal square feet as a proposed building, or invent missing report topics",()=>{
  const overview=caseProjectOverview({...hearing,appType:"ANN",appTypeLabel:"Annexation",description:"Annexation to IL"},{SquareFeet:123456} as EnerGovPlan,[],data,source,false);
  expect(overview.buildingArea).toBeUndefined();expect(overview.homes).toBeUndefined();
  const html=renderToStaticMarkup(createElement(ProjectProposal,{overview,data,terms:[]}));
  expect(html).not.toContain("Schools");expect(html).not.toContain("Traffic");expect(html).not.toContain("recommended conditions");
});
it("keeps legal descriptions and the city office parcel out of resident-facing prose",()=>{
  expect(safeProposalSummary("Landowner Jane at parcel R3055100000 in Section 3.")).toBeUndefined();
  expect(caseLocation(hearing,{MainAddress:"411 3rd St S",MainParcelNumber:"R1542600000"} as EnerGovPlan)).toBeUndefined();
  const overview=caseProjectOverview({...hearing,description:"Parcel R3055100000, Section 3 T3N R1W"},null,[],{...data,fields:[field("requestSummary","Parcel R3055100000, Section 3 T3N R1W")]},source,false);
  expect(overview.summary).not.toMatch(/parcel|Section 3|T3N|R1W/i);
});
it("keeps both a reviewed result and a different case's direct city decision",()=>{
  const reviewed={...field("councilDecision","approved"),status:"approved" as const,sourceKind:"council-decision" as const};
  const rows=projectTimelineRows({...data,caseIds:[hearing.appId,"ANN-00999-2026"],fields:[reviewed],cityDecisions:[{caseId:"ANN-00999-2026",date:"2026-10-19",result:"Denied",sourceUrl:source}]},"2026-10-23");
  expect(rows.filter(r=>r.stage==="Council hearing").map(r=>r.text)).toEqual(["Approved","Denied, Oct 19, 2026"]);
});

it("groups an explicit project name without treating generic descriptions as names",()=>{
  expect(caseGroupingName({...hearing,appScope:"Resting Rock",description:undefined})).toBe("Resting Rock");
  expect(caseGroupingName({...hearing,appScope:"Annexation of parcels in Section 3",description:undefined})).toBeUndefined();
});
