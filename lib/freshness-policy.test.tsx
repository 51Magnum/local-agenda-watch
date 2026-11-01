import {afterEach,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {latestSuccessfulCheck} from "./maps/record-freshness";
import {emptyEvidenceState} from "./timeline/types";
import {emptySchedule,finishSchedule} from "./timeline/schedule";
import {hearingDateTime,residentDateText} from "./areas/format";
import {residentMapCase,titleReviewReason} from "./resident-content-policy";
import {countyFromFeature} from "./sources/canyon-county";
import ProjectPane from "../app/components/maps/project-pane";
import Disclaimer from "../app/disclaimer/page";
import review from "../data/review/ada-county.json";
import type {PaneData} from "./maps/project-questions";
afterEach(()=>vi.restoreAllMocks());
it("advances only this record's successful checks, preserving success after failures",()=>{
 const state=emptyEvidenceState(),schedule={...emptySchedule(),recordChecks:{nampa:{CASE:"2026-11-01T17:00:00Z",OTHER:"2026-11-02T17:00:00Z"}}};
 state.documents.failed={id:"failed",areaId:"nampa",caseIds:["CASE"],checkedAt:"2026-11-03T17:00:00Z",state:"error",error:"Unavailable",pages:[],kind:"staff-report",hash:"hash",title:"Report",url:"https://official.test"};
 expect(latestSuccessfulCheck({areaId:"nampa",caseIds:["CASE"],state,schedule})).toBe("2026-11-01T17:00:00Z");
 state.documents.ok={...state.documents.failed,id:"ok",state:"complete",error:undefined,checkedAt:"2026-11-01T18:00:00Z"};
 expect(latestSuccessfulCheck({areaId:"nampa",caseIds:["CASE"],state,schedule})).toBe("2026-11-01T18:00:00Z");
});
it("records successful per-record checks on partial follow-ups, not only full area sweeps",()=>{
 const next=finishSchedule(emptySchedule(),{slot:"followup",modes:[],meetingIds:[],recheckCaseIdsByArea:{},fullSweep:false},{},emptyEvidenceState(),{},new Date("2026-11-01T18:00:00Z"),{nampa:["CASE"]});
 expect(next.recordChecks.nampa.CASE).toBe("2026-11-01T18:00:00.000Z");
});
it("formats Boise summer/winter instants in Mountain Time and date-only timeline prose in words",()=>{
 for(const date of ["2026-08-12T00:00:00Z","2026-12-12T01:00:00Z"])expect(hearingDateTime(date,"America/Boise")).toContain("Mountain Time");
 const text=residentDateText("Received · 2026-08-12; agenda · 2026-08-12; outcome not established. America/Boise","America/Boise");
 expect(text).toContain("Aug 12, 2026");expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}|America\/|outcome not established/);
});
it("removes parcel boilerplate at County collection and parcel identifiers from resident records",()=>{
 const collected=countyFromFeature({properties:{PermitNum:"CR2026-0001",Description:"Parcel details: Section 4 Township 3 Range 2",ParcelNum:"PRIVATE-JOIN-KEY"}});
 expect(collected.description).toBe("");const item={...review.records[0].project.item,parcelIds:["PRIVATE-JOIN-KEY"],parcelNamespace:"internal",summary:"Parcel details: Township 3 Section 4"};
 expect(residentMapCase(item as PaneData["item"])).not.toHaveProperty("parcelIds");expect(residentMapCase(item as PaneData["item"])).not.toHaveProperty("parcelNamespace");expect(residentMapCase(item as PaneData["item"]).summary).toBe("");
});
it.each(["Shep Law Office","Jane Smith","Example Holdings LLC"])("flags a possible named title for review: %s",title=>{expect(titleReviewReason(title)).toBeTruthy();});
it("does not flag a descriptive project title or a recognized development name",()=>{expect(titleReviewReason("Braeburn Creek")).toBeUndefined();expect(titleReviewReason("Rezone for a neighborhood of 40 homes")).toBeUndefined();});
it.each([false,true])("labels an AI summary and links the disclaimer in pane/page: %s",page=>{
 const data=structuredClone(review.records[0].project) as PaneData;data.item.popup={...data.item.popup!,explanation:"A sourced generated summary.",aiGenerated:true};data.history=[{label:"Board agenda · 2026-08-12; outcome not established"}];data.parcels=["DO-NOT-PUBLISH"];data.noHearing={message:"No hearing scheduled in official agendas as of 2026-10-31.",sources:[]};
 const html=renderToStaticMarkup(<ProjectPane data={data} page={page} onClose={()=>{}} onWatch={()=>{}} onImage={()=>{}}/>);
 expect(html).toContain("AI-generated summary");expect(html).toContain('href="/disclaimer"');expect(html).not.toContain("Parcel details");expect(html).not.toContain("DO-NOT-PUBLISH");expect(html).not.toContain("2026-08-12");expect(html).not.toContain("America/Boise");expect(html).not.toContain("as of 2026-10-31");
});
it("provides a disclaimer page explaining official records and AI fallibility",()=>{const html=renderToStaticMarkup(<Disclaimer/>);expect(html).toContain("Official records control");expect(html).toContain("AI-generated summaries");});
