import {describe,expect,it} from "vitest";
import {AREAS} from "@/lib/areas/registry";
import {emptyEvidenceState,type EvidenceField} from "./types";
import {emptySchedule,finishSchedule,mergeMeetingIndex,planSchedule,resolvedMeetingCases,schedulerWindow,type MeetingWatch} from "./schedule";
const watch=(date="2026-10-19"):MeetingWatch=>({id:"meeting",areaId:"nampa",body:"City Council",date,caseIds:["ANN-ONE"],resolvedCaseIds:[]});
const state=(m=watch())=>({...emptySchedule(),meetings:[m]});
const plan=(date:string,m=watch())=>planSchedule(state(m),AREAS,new Date(date));
it("records completion time for each successful area sweep and retains it when a later sweep fails",()=>{
 const now=new Date("2026-10-26T12:00:00Z");
 const areas=Object.values(AREAS).filter(a=>a.status==="live"&&a.timeline);
 const feeds=Object.fromEntries(areas.map(a=>[a.id,{active:[],completed:[],refreshedAt:"2026-01-01T00:00:00Z"}]));
 const forced=planSchedule(emptySchedule(),AREAS,now,{manual:true,force:true})!;
 const completed=finishSchedule(emptySchedule(),forced,feeds,emptyEvidenceState(),AREAS,now);
 for(const area of areas)expect(completed.sweeps?.[area.id]?.lastSuccessAt).toBe(now.toISOString());
 const failed=finishSchedule(completed,forced,{...feeds,meridian:{...feeds.meridian,scheduleUnavailable:true}},emptyEvidenceState(),AREAS,new Date("2026-10-27T12:00:00Z"));
 expect(failed.sweeps?.meridian.lastSuccessAt).toBe(now.toISOString());
 expect(failed.sweeps?.meridian.lastAttemptAt).toBe("2026-10-27T12:00:00.000Z");
 expect(failed.sweeps?.meridian.warning).toContain("incomplete");
});
describe("Denver scheduler",()=>{
 it("accepts delayed runs across DST inside the AM and PM windows",()=>{
  expect(schedulerWindow(new Date("2026-10-24T11:00:00Z"))?.period).toBe("am");
  expect(schedulerWindow(new Date("2026-10-24T12:00:00Z"))?.period).toBe("am");
  expect(schedulerWindow(new Date("2026-10-24T20:32:00Z"))?.period).toBe("pm");
  expect(schedulerWindow(new Date("2026-11-02T11:00:00Z"))).toBeNull();
  expect(schedulerWindow(new Date("2026-11-02T12:00:00Z"))?.period).toBe("am");
  expect(schedulerWindow(new Date("2026-11-02T21:00:00Z"))?.period).toBe("pm");
  expect(schedulerWindow(new Date("2026-11-02T20:00:00Z"))).toBeNull();
 });
 it("sweeps only in the morning and does no afternoon work without a due meeting",()=>{
  expect(planSchedule(emptySchedule(),AREAS,new Date("2026-10-24T11:00:00Z"))?.modes).toEqual(["daily-sweep"]);
  expect(planSchedule(emptySchedule(),AREAS,new Date("2026-10-24T20:00:00Z"))).toBeNull();
 });
 it("checks the day after at both times and days 2–14 only in the morning",()=>{
  expect(plan("2026-10-20T11:00:00Z")?.modes).toContain("post-meeting");
  expect(plan("2026-10-20T20:00:00Z")?.caseIdsByArea).toEqual({nampa:["ANN-ONE"]});
  expect(plan("2026-10-21T20:00:00Z")).toBeNull();
  expect(plan("2026-11-02T12:00:00Z")?.modes).toContain("post-meeting");
  expect(plan("2026-11-02T21:00:00Z")).toBeNull();
 });
 it("checks older unresolved meetings weekly and stops only their resolved cases",()=>{
  const m={...watch(),lastChecked:"2026-11-02"};
  expect(plan("2026-11-03T12:00:00Z",m)?.modes).not.toContain("post-meeting");
  expect(plan("2026-11-09T12:00:00Z",m)?.modes).toContain("post-meeting");
  expect(plan("2026-11-09T12:00:00Z",{...m,resolvedCaseIds:m.caseIds})?.modes).not.toContain("post-meeting");
 });
 it("checks tomorrow's hearing only at 2 PM and scopes the work by area",()=>{
  expect(plan("2026-10-18T20:00:00Z")?.modes).toEqual(["pre-hearing"]);
  expect(plan("2026-10-18T20:00:00Z")?.caseIdsByArea).toEqual({nampa:["ANN-ONE"]});
  expect(plan("2026-10-18T11:00:00Z")?.modes).not.toContain("pre-hearing");
 });
 it("deduplicates completed slots but supports a forced full sweep at any time",()=>{
  const s={...emptySchedule(),slots:{"2026-10-24:am":"done"}};
  expect(planSchedule(s,AREAS,new Date("2026-10-24T11:10:00Z"))).toBeNull();
  expect(planSchedule(s,AREAS,new Date("2026-10-24T17:00:00Z"),{manual:true,force:true})?.modes).toEqual(["forced-full-sweep"]);
 });
 it("merges case/agenda associations and preserves meetings removed by a portal",()=>{
  const s=state();
  const feed={active:[],completed:[],agendaMeetings:[{id:"1",body:"City Council",bodyLabel:"Council",title:"Council",date:"2026-10-19",dateLabel:"",sourceUrl:"https://example.gov",items:[{title:"Case",caseIds:["ANN-TWO"],agendaUrl:"",staffReports:[]}]}]};
  const merged=mergeMeetingIndex({...s,meetings:[{...s.meetings[0],id:"nampa:City Council:2026-10-19"}]},{nampa:feed},AREAS);
  expect(merged).toHaveLength(1);expect(merged[0].caseIds).toEqual(["ANN-ONE","ANN-TWO"]);
  expect(mergeMeetingIndex(s,{},AREAS)).toEqual(s.meetings);
 });
 it("recognizes a pending decision document only for its own hearing without approving it",()=>{
  const evidence=emptyEvidenceState();
  evidence.documents.doc={id:"doc",hash:"v1",areaId:"nampa",url:"https://www.cityofnampa.us/decision.pdf",title:"Decision",caseIds:["ANN-ONE"],kind:"council-decision",state:"complete",checkedAt:"2026-10-21",pages:[]};
  const f:EvidenceField={id:"f",areaId:"nampa",caseId:"ANN-ONE",documentId:"doc",documentHash:"v1",key:"councilDecision",value:"approved",sourceKind:"council-decision",sourceUrl:"",page:1,quote:"",confidence:1,status:"pending",createdAt:""};
  evidence.fields.f=f;evidence.fields.date={...f,id:"date",key:"decisionDate",value:"2026-10-19"};
  expect(resolvedMeetingCases(watch(),evidence,AREAS.nampa)).toEqual(["ANN-ONE"]);
  expect(resolvedMeetingCases(watch("2026-10-26"),evidence,AREAS.nampa)).toEqual([]);
  expect(evidence.fields.f.status).toBe("pending");
 });
 it("does not advance weekly cadence for unvisited cases after a budget cutoff",()=>{
  const s=state(),p=planSchedule(s,AREAS,new Date("2026-11-09T12:00:00Z"))!;
  expect(finishSchedule(s,p,{},emptyEvidenceState(),AREAS,new Date("2026-11-09T12:00:00Z"),{}).meetings[0].lastChecked).toBeUndefined();
  expect(finishSchedule(s,p,{},emptyEvidenceState(),AREAS,new Date("2026-11-09T12:00:00Z"),{nampa:["ANN-ONE"]}).meetings[0].lastChecked).toBe("2026-11-09");
 });
});

it("accepts all delayed window hours and retains one durable slot",()=>{
 for(const utc of [11,12,13,14,15])expect(schedulerWindow(new Date(`2026-10-25T${utc}:59:00Z`))?.period).toBe("am");
 expect(schedulerWindow(new Date("2026-10-25T16:00:00Z"))).toBeNull();
 for(const utc of [20,21,22,23])expect(schedulerWindow(new Date(`2026-10-25T${utc}:59:00Z`))?.period).toBe("pm");
 expect(schedulerWindow(new Date("2026-10-26T00:59:00Z"))?.period).toBe("pm");
 expect(schedulerWindow(new Date("2026-10-26T01:00:00Z"))).toBeNull();
 const s=emptySchedule();s.slots["2026-10-25:am"]="done";expect(planSchedule(s,AREAS,new Date("2026-10-25T15:00:00Z"))).toBeNull();
 expect(planSchedule(s,AREAS,new Date("2026-10-25T18:00:00Z"),{manual:true,force:true})?.fullSweep).toBe(true);
});
