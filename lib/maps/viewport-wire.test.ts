import { expect, it } from "vitest";
import { roundMapPayload, packViewport, unpackViewport } from "./viewport-wire";
import type { ViewportData } from "./viewport";
it("preserves map drawing, filters and project selection while omitting record and parcel payloads", () => {
  const c = { id: "nampa:ANN-00371-2026", areaId: "nampa", title: "Braeburn Creek", stage: "Council/Board", centroid: [-116.5,43.5], geometry: null, confidence: "exact", uses: ["homes"], nextHearing: {date:"2026-11-02", body:"City Council", label:"Council hearing"}, decisionDate: "2026-10-19", popup: {headline:"487 new homes",projectName:"Braeburn Creek",progress:[]},jurisdictionLabel:"City of Nampa",timezone:"America/Denver",members:[{areaId:"nampa",caseId:"ANN-00371-2026",title:"Braeburn Creek",href:"/us/id/nampa/braeburn-creek",stage:"Council/Board",body:"City Council"}],parcelIds:["PRIVATE-MAP-METADATA"],bounds:[-116.6,43.4,-116.4,43.6],href:"/us/id/nampa/braeburn-creek",type:"annexation",typeLabel:"Annexation",summary:"",source:"polygon",citywide:false,flumCategories:[] } as ViewportData["cases"][number];
  const data: ViewportData = {cases:[c], summaries:[],truncated:false,updatedAt:"2026-10-25",bounds:[-117,43,-116,44]};
  const packed=packViewport(data), result=unpackViewport(packed).cases[0];
  const ai=unpackViewport(packViewport({...data,cases:[{...c,aiTitle:true}]})).cases[0];expect(ai.aiTitle).toBe(true);expect(result.aiTitle).toBeUndefined();
  for (const key of ["id","areaId","title","stage","centroid","geometry","confidence","uses","nextHearing","decisionDate","popup","jurisdictionLabel","timezone"] as const) expect(result[key]).toEqual(c[key]);
  expect(JSON.stringify(packed)).not.toContain("PRIVATE-MAP-METADATA");
  expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(data).length*.65);
});

it("rounds nested geometry, bounds and centroids to six decimals without changing identifiers",()=>{expect(roundMapPayload({id:"123.12345678",coordinates:[[1.123456789,-116.567891234]],bounds:[43.123456789]})).toEqual({id:"123.12345678",coordinates:[[1.123457,-116.567891]],bounds:[43.123457]});});
import {projectPolygonFeature} from "./project-feature";
import type {MapCase} from "./types";
it("keeps one stable string ID on every part through packing and numeric rounding",()=>{
 const geometry={type:"MultiPolygon" as const,coordinates:Array.from({length:12},(_,i)=>[[[i,0],[i+.2,0],[i+.2,.2],[i,.2],[i,0]]])};
 const source={id:"ada-county:many-parts",areaId:"ada-county",geometry,centroid:[0,0],stage:"In review",confidence:"exact"} as MapCase;
 const data={cases:[source],summaries:[],truncated:false,updatedAt:"",bounds:[-180,-85,180,85]} as ViewportData;
 const decoded=unpackViewport(roundMapPayload(packViewport(data))).cases[0];expect(decoded.id).toBe(source.id);expect(decoded.geometry).toEqual(geometry);
 const rendered=projectPolygonFeature(decoded.id,decoded.geometry!,{});expect(rendered.id).toBe(source.id);expect(rendered.properties?.id).toBe(source.id);expect(rendered.geometry).toMatchObject({type:"MultiPolygon",coordinates:geometry.coordinates});
});
