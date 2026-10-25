import { expect, it } from "vitest";
import { AREAS } from "@/lib/areas/registry";
import { emptyEvidenceState, publicFields, type EvidenceField } from "@/lib/timeline/types";
import type { Hearing, ScheduledMeeting } from "@/lib/localities/types";
import type { MapCase } from "./types";
import { buildPopupModel, popupProjectName } from "./popup-model";
const now = new Date("2026-10-24T15:00:00Z");
const item = { id:"ANN-00371-2026", title:"Braeburn Creek annexation", stage:"Council/Board", href:"/us/id/nampa/braeburn-creek" } as MapCase;
const meeting = (date:string,body:string,result?:string):ScheduledMeeting => ({date,body,bodyLabel:body,dateLabel:date,time:"18:00",result,continuedNote:null,sourceUrl:"https://official.test/hearing"});
const field = (key:string,value:string,extra:Partial<EvidenceField>={}):EvidenceField => ({id:key,areaId:"nampa",caseId:item.id,documentId:"latest",documentHash:"hash",key:key as EvidenceField["key"],value,sourceUrl:"https://official.test/report",page:1,quote:"Exact quoted application evidence",confidence:1,sourceKind:"staff-report",status:"auto_published",createdAt:"2026-10-01",...extra});
it("Braeburn leads with latest filing copy and approved P&Z result, then Council date/time",()=>{
 const fields=[field("popupHeadline","487 new homes on 138 acres"),field("popupExplanation","Toll Brothers wants to build a neighborhood of single-family homes."),field("pzResult","recommend approval",{status:"approved",sourceKind:"pz-decision"}),field("pzHearingDate","2026-09-29")];
 const model=buildPopupModel(item,AREAS.nampa,{meetings:[meeting("2026-09-29","P&Z"),meeting("2026-11-02","City Council")]} as Hearing,fields,now);
 expect(model.headline).toBe("487 new homes on 138 acres");
 expect(model.progress).toEqual([{label:"Filed",state:"done"},{label:"P&Z recommended approval (Sep 29)",state:"done"},{label:"City Council · Mon, Nov 2, 2026 · 6 PM Mountain Time",state:"current"},{label:"Decision",state:"future"}]);
});
it("unapproved decisions cannot become public progress",()=>{
 const state=emptyEvidenceState();state.documents.latest={id:"latest",hash:"hash",state:"complete"} as never;
 state.fields.decision=field("councilDecision","approved",{status:"pending",sourceKind:"council-decision"});
 const model=buildPopupModel(item,AREAS.nampa,undefined,publicFields(state,[item.id],"nampa"),now);
 expect(JSON.stringify(model)).not.toContain("Approved");expect(model.progress.some(p=>p.label==="Under review, no hearing set yet")).toBe(true);
});
it("County uses the actual Hearing Examiner and Board names, stopping at a final denial",()=>{
 const h={meetings:[meeting("2026-09-10","Hearing Examiner","recommend approval"),meeting("2026-10-19","Board of County Commissioners","Denied")]} as Hearing;
 const model=buildPopupModel({...item,stage:"Decided"},AREAS["canyon-county"],h,[],now);
 expect(model.progress[1].label).toContain("Hearing Examiner recommended approval");
 expect(model.progress.at(-1)).toEqual({label:"Denied by Board, Oct 19",state:"current"});
 expect(model.progress.some(p=>p.state==="future")).toBe(false);
});
it("Meridian uses P&Z and City Council and has no invented outcome",()=>{
 const model=buildPopupModel({...item,title:"Hyperbaric Oxygen Clinic of Idaho"},AREAS.meridian,{meetings:[meeting("2026-10-15","P&Z"),meeting("2026-11-03","City Council")]} as Hearing,[],now);
 expect(model.headline).toBe("Hyperbaric Oxygen Clinic of Idaho");expect(model.explanation).toBeUndefined();
 expect(model.progress[1].label).toBe("P&Z met; result pending (Oct 15)");expect(model.progress[2].label).toBe("City Council · Tue, Nov 3, 2026 · 6 PM Mountain Time");
});
it("a newer application without published short copy never borrows older numbers",()=>{
 const model=buildPopupModel(item,AREAS.nampa,undefined,[field("popupHeadline","500 new homes on 137 acres",{documentId:"old",createdAt:"2026-03-01"}),field("requestSummary","Updated application",{documentId:"new",createdAt:"2026-09-01"})],now);
 expect(model.headline).toBe("Braeburn Creek Annexation");expect(JSON.stringify(model)).not.toContain("500");
});
it("removes case codes from fallback names and rejects oversized explanation",()=>{
 expect(popupProjectName("Gas station (CUP-00411-2026)")).toBe("Gas station");
 const model=buildPopupModel(item,AREAS.nampa,undefined,[field("popupExplanation",Array(26).fill("word").join(" "))],now);expect(model.explanation).toBeUndefined();
});

it("shows an explicit official approval even when no Council meeting result is linked",()=>{
 const model=buildPopupModel({...item,id:"PANN-00003-2026",title:"Pre-annexation",stage:"Decided"},AREAS.nampa,{appStatus:"Approved",meetings:[]} as unknown as Hearing,[],now);
 expect(model.progress.at(-1)).toEqual({label:"Approved — city record",state:"current"});
 expect(JSON.stringify(model)).not.toContain("by Council");expect(model.progress.some(p=>p.state==="future")).toBe(false);
});
it("distinguishes a recorded denial from a generic completed status without guessing a date",()=>{
 const denied=buildPopupModel({...item,stage:"Decided"},AREAS.nampa,{appStatus:"Denied",meetings:[]} as unknown as Hearing,[],now);
 expect(denied.progress.at(-1)?.label).toBe("Denied — city record");
 const complete=buildPopupModel({...item,stage:"Decided"},AREAS.nampa,{appStatus:"Complete",meetings:[]} as unknown as Hearing,[],now);
 expect(complete.progress.at(-1)?.label).toBe("Decided; outcome not specified in city record");
});
