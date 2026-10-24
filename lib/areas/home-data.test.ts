import { expect, it } from "vitest";
import { homeAreaData } from "./home-data";
import { AREAS } from "./registry";
import type { Hearing, HearingFeed } from "../localities/types";
it("uses the short case title on recent decisions, preserving plat type and outcome", () => {
  const hearing={appId:"SPF-00294-2025",appType:"SPF",appTypeLabel:"Subdivision plat - final",appScope:"Raw description",appStatus:"Approved",appPhase:"Recording",appAcres:null,meetings:[{body:"City Council",date:"2026-10-19",result:"Approved"}]} as Hearing;
  const feed={active:[],completed:[hearing,{...hearing,appId:"SPP-00175-2026",appType:"SPP",appTypeLabel:"Subdivision plat - preliminary"}]} as HearingFeed;
  const decisions=homeAreaData(AREAS.nampa,feed,new Date("2026-10-24T18:00:00Z")).decisions;
  expect(decisions.find(d=>d.id===hearing.appId)).toMatchObject({title:"Silverland Park final plat",outcome:"Approved",date:"2026-10-19"});
  expect(decisions.find(d=>d.id==="SPP-00175-2026")?.title).toBe("Elite Industrial preliminary plat");
});

it("shows only decisions dated within 90 days in the area timezone",()=>{
 const decision=(id:string,date?:string)=>({appId:id,appType:"CUP",appTypeLabel:"Conditional use",appStatus:"Approved",appPhase:"Recording",appAcres:null,meetings:date?[{body:"City Council",date,result:"Approved"}]:[]}) as unknown as Hearing;
 const feed={active:[],completed:[decision("old","2026-07-25"),decision("edge","2026-07-26"),decision("new","2026-10-24"),decision("future","2026-10-25"),decision("unknown")]} as HearingFeed;
 expect(homeAreaData(AREAS.nampa,feed,new Date("2026-10-25T01:00:00Z")).decisions.map(d=>d.id)).toEqual(["new","edge"]);
});
