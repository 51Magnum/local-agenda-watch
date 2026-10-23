import { expect, it } from "vitest";
import { homeAreaData } from "./home-data";
import { AREAS } from "./registry";
import type { Hearing, HearingFeed } from "../localities/types";
it("uses the short case title on recent decisions, preserving plat type and outcome", () => {
  const hearing={appId:"SPF-00294-2025",appType:"SPF",appTypeLabel:"Subdivision plat - final",appScope:"Raw description",appStatus:"Approved",appPhase:"Recording",appAcres:null,meetings:[{body:"City Council",date:"2026-10-19",result:"Approved"}]} as Hearing;
  const feed={active:[],completed:[hearing,{...hearing,appId:"SPP-00175-2026",appType:"SPP",appTypeLabel:"Subdivision plat - preliminary"}]} as HearingFeed;
  const decisions=homeAreaData(AREAS.nampa,feed).decisions;
  expect(decisions.find(d=>d.id===hearing.appId)).toMatchObject({title:"Silverland Park final plat",outcome:"Approved",date:"2026-10-19"});
  expect(decisions.find(d=>d.id==="SPP-00175-2026")?.title).toBe("Elite Industrial preliminary plat");
});
