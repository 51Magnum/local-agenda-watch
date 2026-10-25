import { expect, it } from "vitest";
import { packViewport, unpackViewport } from "./viewport-wire";
import type { ViewportData } from "./viewport";
it("preserves map drawing, filters and project selection while omitting record and parcel payloads", () => {
  const c = { id: "nampa:ANN-00371-2026", areaId: "nampa", title: "Braeburn Creek", stage: "Council/Board", centroid: [-116.5,43.5], geometry: null, confidence: "exact", uses: ["homes"], nextHearing: {date:"2026-11-02", body:"City Council", label:"Council hearing"}, decisionDate: "2026-10-19", popup: {headline:"487 new homes",projectName:"Braeburn Creek",progress:[]},jurisdictionLabel:"City of Nampa",timezone:"America/Denver",members:[{areaId:"nampa",caseId:"ANN-00371-2026",title:"Braeburn Creek",href:"/us/id/nampa/braeburn-creek",stage:"Council/Board",body:"City Council"}],parcelIds:["PRIVATE-MAP-METADATA"],bounds:[-116.6,43.4,-116.4,43.6],href:"/us/id/nampa/braeburn-creek",type:"annexation",typeLabel:"Annexation",summary:"",source:"polygon",citywide:false,flumCategories:[] } as ViewportData["cases"][number];
  const data: ViewportData = {cases:[c], summaries:[],truncated:false,updatedAt:"2026-10-25",bounds:[-117,43,-116,44]};
  const packed=packViewport(data), result=unpackViewport(packed).cases[0];
  for (const key of ["id","areaId","title","stage","centroid","geometry","confidence","uses","nextHearing","decisionDate","popup","jurisdictionLabel","timezone"] as const) expect(result[key]).toEqual(c[key]);
  expect(JSON.stringify(packed)).not.toContain("PRIVATE-MAP-METADATA");
  expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(data).length*.65);
});
