import { ProjectFacts } from "@/app/components/project-overview";
import { northsideOverview } from "./northside-project";
import { shortDate, hearingDay } from "./project-timeline";
import { createElement } from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectProposal, ProjectTimeline } from "@/app/components/project-overview";
import { braeburnOverview, projectOverview, projectDensity, projectDocumentList } from "./project-overview";
import { projectTimelineRows } from "./project-timeline";
import { buildTimeline } from "./timeline/public";
import { emptyEvidenceState, type EvidenceField } from "./timeline/types";
import type { TimelineData } from "./timeline/public";
const ids=["ANN-00371-2026","SPP-00184-2026"];
const base:TimelineData={fields:[],appearances:[],caseIds:ids,currentStage:"Council hearing",finalDecisionApproved:false,next:{startsAt:"2026-11-02T18:00:00-07:00",body:"City Council",location:"City Hall",sourceUrl:"https://city.test/hearings"}};
function field(key:EvidenceField["key"],value:string,caseId=ids[0],status:EvidenceField["status"]="approved"):EvidenceField{return{id:key+caseId,documentId:"decision",documentHash:"hash",caseId,key,value,sourceUrl:"https://city.test/decision.pdf",page:1,quote:"Explicit evidence on this page",confidence:1,status,createdAt:"2026-10-01",sourceKind:"pz-decision"};}
it("merges shared P&Z dates, results, votes and testimony into one sourced row",()=>{
  const fields=ids.flatMap(id=>[field("pzHearingDate","2026-09-29",id),field("pzResult","recommend approval",id),field("pzVote","6–0",id),{...field("pzSpeakersFor","2",id),sourceKind:"minutes" as const,documentId:"minutes",sourceUrl:"https://city.test/minutes.pdf"},{...field("pzSpeakersAgainst","3",id),sourceKind:"minutes" as const,documentId:"minutes"},{...field("pzHearingDate","2026-09-29",id),sourceKind:"minutes" as const,documentId:"minutes"}]);
  const data={...base,fields};const rows=projectTimelineRows(data,"2026-10-23");const pz=rows.filter(r=>r.stage==="P&Z hearing");expect(pz).toHaveLength(1);expect(pz[0]).toMatchObject({text:"Recommended approval, Sep 29, 2026",vote:"6–0",support:"2",opposition:"3"});expect(pz[0].caseIds).toBeUndefined();expect(pz[0].sources).toHaveLength(2);
  const html=renderToStaticMarkup(createElement(ProjectTimeline,{data}));expect((html.match(/Recommended approval/g)??[])).toHaveLength(1);expect(html).toContain("Upcoming: Nov 2, 2026");
});
it("splits linked cases when their reviewed outcomes differ",()=>{
  const rows=projectTimelineRows({...base,fields:[field("pzHearingDate","2026-09-29"),field("pzResult","recommend approval"),field("pzResult","recommend denial",ids[1])]});expect(rows.filter(r=>r.stage==="P&Z hearing")).toHaveLength(2);
});
it("hides unapproved outcomes, conditions and testimony; never uses engineering conditions as P&Z conditions",()=>{
  const fields=[field("pzResult","recommend approval",ids[0],"pending"),field("pzSpeakersFor","9",ids[0],"pending"),field("pzConditions","Unapproved condition",ids[0],"pending"),{...field("keyConditions","Engineering suggestion"),sourceKind:"staff-report" as const}];
  const data={...base,fields,appearances:[{date:"2026-09-29",body:"Planning & Zoning",sourceUrl:"https://city.test/agenda",isHearing:true}]};
  expect(projectTimelineRows(data,"2026-10-23").find(r=>r.stage==="P&Z hearing")?.text).toContain("result pending");
  const html=renderToStaticMarkup(createElement(ProjectProposal,{overview:{summary:"A proposal."},data}));expect(html).not.toContain("Unapproved condition");expect(html).not.toContain("Engineering suggestion");expect(html).not.toContain("Schools");expect(html).not.toContain("Traffic");
});
it("shows at most five reviewed conditions initially and keeps the remainder collapsed",()=>{
  const data={...base,fields:[field("pzConditions",Array.from({length:7},(_,i)=>"Condition "+(i+1)).join("\n"))]};
  const html=renderToStaticMarkup(createElement(ProjectProposal,{overview:{summary:"A proposal."},data}));expect(html).toContain("Show all 7 conditions");expect(html.indexOf("Condition 6")).toBeGreaterThan(html.indexOf("<details"));
});
it("computes the approximate gross density and deduplicates project documents",()=>{
  const overview=projectOverview(base,braeburnOverview);expect(projectDensity(overview)).toBe("~3.5 homes/acre");
  const document={label:"Staff report",url:"https://city.test/report.pdf",sourceUrl:"https://city.test/agenda"};const group={id:ids[0],label:"Annexation",portalUrl:"https://city.test/record",retrievalFailed:false,documents:[document]};expect(projectDocumentList([group,{...group,id:ids[1]}]).key).toEqual([document]);
});
it("keeps new decision-adjacent fields behind the existing public approval gate",()=>{
  const state=emptyEvidenceState();state.documents.decision={id:"decision",hash:"hash",state:"complete",kind:"pz-decision",caseIds:ids,url:"https://city.test/decision.pdf",title:"P&Z decision",pages:[],checkedAt:""};for(const key of ["pzConditions","pzSpeakersFor","pzSpeakersAgainst"] as const){const f=field(key,"2",ids[0],"auto_published");state.fields[f.id]=f;}
  expect(buildTimeline(state,{caseIds:ids,stage:"Council hearing"}).fields).toEqual([]);
});

it("uses zoning facts without housing density or invented building area",()=>{
  const html=renderToStaticMarkup(createElement(ProjectFacts,{overview:northsideOverview}));
  expect(html).toContain("Annexation &amp; zoning");expect(html).toContain("1.69");expect(html).toContain("IL (Light Industrial)");expect(html).toContain("Canyon County");
  expect(html).not.toContain("Homes / lots");expect(html).not.toContain("homes/acre");expect(html).not.toContain("Building area");
});
it("keeps UTC evening hearings on their Denver calendar day",()=>{
  expect(shortDate("2026-11-03T01:00:00.000Z")).toBe("Nov 2, 2026");expect(hearingDay("2026-11-03T01:00:00.000Z")).toBe("2026-11-02");
  expect(projectTimelineRows({...base,next:{...base.next!,startsAt:"2026-11-03T01:00:00.000Z"}}).find(r=>r.stage==="Council hearing")?.text).toBe("Upcoming: Nov 2, 2026");
});
