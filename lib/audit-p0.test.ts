import {continuanceHistory} from "./continuances";
import {expect,it} from "vitest";
import {residentialCase,blockAddress,protectMapCase,privateResidentialDocument} from "./residential-privacy";
import {expiredCommentDeadline,participationClosed} from "./participation";
import {timelineHealth} from "./timeline/health";
import {emptySchedule,finishSchedule,planSchedule} from "./timeline/schedule";
import {emptyEvidenceState} from "./timeline/types";
import {AREAS} from "./areas/registry";
import {combineRadiusCases} from "./maps/radius";
import type {MapCase} from "./maps/types";
const now=new Date("2026-10-25T12:00:00Z");
const item=(id:string,props:Partial<MapCase>={}):MapCase=>({id,title:id,summary:"",type:"",typeLabel:"",stage:"Filed",href:"/plan/"+id,geometry:{type:"Polygon",coordinates:[[[-116.5,43.5],[-116.49,43.5],[-116.49,43.51],[-116.5,43.5]]]},centroid:[-116.495,43.505],parcelIds:["R1"],parcelNamespace:"same",source:"polygon",confidence:"exact",citywide:false,flumCategories:[],...props});
it("selects the next hearing as the lead, independent of input order, with every display field from that case",()=>{
 const old=item("H-2025-0052",{stage:"Decided",recordStatus:"Approved",decisionDate:"2025-03-10"});
 const active=item("H-2026-0053",{title:"Thruston Choi Farms",stage:"Council/Board",nextHearing:{date:"2026-10-27",body:"City Council",label:"Council hearing"}});
 for(const cases of [[old,active],[active,old]]){const merged=combineRadiusCases([{area:AREAS.meridian,cases}],[-116.5,43.5],1,now)[0];expect(merged.id).toBe("meridian:H-2026-0053");expect(merged.title).toBe(active.title);expect(merged.stage).toBe("Council/Board");expect(merged.href).toContain("H-2026-0053");expect(merged.nextHearing?.date).toBe("2026-10-27");expect(merged.members?.[0].caseId).toBe(active.id);expect(merged.members).toHaveLength(2);}
});
it("does not let a withdrawn or closed case with a stale hearing outrank an active filing",()=>{
 const a=item("NEW",{caseDate:"2026-10-20"}),b=item("OLD",{stage:"Decided",recordStatus:"Withdrawn",nextHearing:{date:"2026-10-26",body:"Council",label:"old"}});
 expect(combineRadiusCases([{area:AREAS.meridian,cases:[b,a]}],[-116.5,43.5],1,now)[0].title).toBe("NEW");
});
it("explains a past comment deadline only while the hearing remains upcoming",()=>{
 expect(expiredCommentDeadline("2026-09-28","2026-12-15","Board of County Commissioners","America/Denver",now)).toContain("The posted comment deadline (Sep 28) has passed.");
 expect(expiredCommentDeadline("2026-10-26","2026-12-15","Board","America/Denver",now)).toBeUndefined();
 for(const recordStatus of ["Approved","Denied","Withdrawn"])expect(participationClosed({recordStatus})).toBe(true);
 expect(participationClosed({recordStatus:"Recommended approval",stage:"Council/Board"})).toBe(false);
});
it("protects home occupations, addresses and geometry, with an explicit admin override",()=>{
 expect(residentialCase("nampa","CUP-00412-2026",{})).toBe(true);
 expect(residentialCase("test","PERMIT-1",{summary:"Home daycare at an existing residence"})).toBe(true);
 expect(residentialCase("test","PLAT-1",{summary:"487 single-family homes"})).toBe(false);
 expect(blockAddress("1234 W Example St, Nampa; 29 East Main Road")).toBe("1200 block of W Example St, Nampa; 0 block of East Main Road");
 const c=item("CUP-00412-2026",{title:"Daycare at 1234 W Example St",centroid:[-116.49672,43.50771]});
 const protectedCase=protectMapCase("nampa",c);expect(protectedCase.title).not.toContain("1234");expect(protectedCase.centroid).not.toEqual(c.centroid);expect(protectedCase.geometry).not.toEqual(c.geometry);expect(protectedCase.visual).toBeUndefined();expect(protectedCase.parcelIds).toBeUndefined();
 expect(protectMapCase("nampa",c,{"nampa/CUP-00412-2026":{mode:"public",reason:"Verified nonresidential"}}).centroid).toEqual(c.centroid);
 expect(privateResidentialDocument("Affidavit of Posting.pdf")).toBe(true);
});
it("flags stale sweeps and unresolved hearings while preserving last-success dates after failed attempts",()=>{
 const state=emptySchedule();state.sweeps={nampa:{lastAttemptAt:"2026-10-23T00:00:00Z",lastSuccessAt:"2026-10-23T00:00:00Z",cases:1,documents:2}};state.meetings=[{id:"old",areaId:"nampa",date:"2026-10-01",body:"City Council",caseIds:["OLD"],resolvedCaseIds:[]}];
 const warnings=timelineHealth(state,{nampa:AREAS.nampa},now);expect(warnings.some(w=>w.includes("30 hours"))).toBe(true);expect(warnings.some(w=>w.includes("14 days"))).toBe(true);
 const plan=planSchedule(state,{nampa:AREAS.nampa},now,{force:true})!;
 const failed=finishSchedule(state,plan,{nampa:{active:[],completed:[],dataUnavailable:true}},emptyEvidenceState(),{nampa:AREAS.nampa},now);
 expect(failed.sweeps.nampa.lastSuccessAt).toBe(state.sweeps.nampa.lastSuccessAt);
});

it("turns a continued-from note on a future County hearing into a sourced timeline row",()=>{
 const rows=continuanceHistory([{date:"2026-12-15",note:"Continued from October 8, 2026",sourceUrl:"https://county.example/hearing"}],"2026-12-15");
 expect(rows).toEqual([{label:"Continued from Oct 8 to Dec 15",source:"https://county.example/hearing"}]);
});

it("keeps a same-day Denver hearing active after UTC midnight",()=>{
 const hearing=item("HEARING",{stage:"Council/Board",nextHearing:{date:"2026-10-25",body:"City Council",label:"Tonight"}});
 const newer=item("NEWER",{caseDate:"2026-10-26"});
 expect(combineRadiusCases([{area:AREAS.meridian,cases:[newer,hearing]}],[-116.5,43.5],1,new Date("2026-10-26T01:00:00Z"))[0].title).toBe("HEARING");
});
