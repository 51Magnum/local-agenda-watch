import {expect,it} from "vitest";
import {booleanPointInPolygon,point} from "@turf/turf";
import {AREAS} from "@/lib/areas/registry";
import {clipCombinedFlum,combineRadiusCases,flumGroup,liveAreasInRadius,sameSite} from "./radius";
import type {CaseGeometry,MapCase} from "./types";
const square=(x:number,y:number,size=.001):CaseGeometry=>({type:"Polygon",coordinates:[[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]]});
const item=(id:string,x=0,y=0):MapCase=>({id,title:id,summary:"Proposed project",type:"ANN",typeLabel:"Annexation",stage:"P&Z",href:"/plan/"+id,geometry:square(x,y),centroid:[x+.0005,y+.0005],source:"polygon",confidence:"exact",citywide:false,flumCategories:[]});
it("finds both city and county at the Victory / Happy Valley edge",()=>{
 const ids=liveAreasInRadius([-116.5099174,43.5756774],1).map(a=>a.id);
 expect(ids).toContain("nampa");expect(ids).toContain("canyon-county");
});
it("finds a city intersecting the circle even when the center is outside its limits",()=>{
 const area={...AREAS.nampa,boundary:square(0,0)};
 expect(liveAreasInRadius([-.001,.0005],.25,[area])).toHaveLength(1);
});
it("deduplicates cross-jurisdiction referrals with over 80% overlap and keeps every case reference",()=>{
 const a=item("CITY"),b={...item("COUNTY"),stage:"Council/Board" as const};
 const result=combineRadiusCases([{area:AREAS.nampa,cases:[a]},{area:AREAS["canyon-county"],cases:[b,item("FAR",1,1)]}],[0,0],1);
 expect(result).toHaveLength(1);expect(result[0].caseIds).toEqual(["CITY","COUNTY"]);expect(result[0].members?.map(m=>m.areaId)).toEqual(["nampa","canyon-county"]);
 expect(result[0].members?.[1].body).toBe("Board of County Commissioners");
});
it("uses matching parcel identifiers only within a shared parcel system; mere containment is not a duplicate",()=>{
 const a={...item("A"),parcelIds:["R123"],parcelNamespace:"county-parcels"},b={...item("B",.1,.1),parcelIds:["R123"],parcelNamespace:"county-parcels"};
 expect(sameSite(a,b)).toBe(true);expect(sameSite(a,{...b,parcelNamespace:"other-county"})).toBe(false);
 expect(sameSite(item("small"),{...item("large"),geometry:square(0,0,.01)})).toBe(false);
});
it("clips city and county FLUM without covering cities with the county plan",()=>{
 const city={...AREAS.nampa,boundary:square(0,0,.01)},county={...AREAS["canyon-county"],boundary:square(-.01,-.01,.04),coverageBoundary:undefined};
 const layer=(value:string)=>({updatedAt:"2026-10-24",geojson:{type:"FeatureCollection" as const,features:[{type:"Feature" as const,geometry:county.boundary,properties:{category:value}}]},legend:[]});
 const result=clipCombinedFlum([{area:city,flum:layer("Medium Density Residential"),categoryField:"category"},{area:county,flum:layer("AGRICULTURE"),categoryField:"category"}],[city],[.005,.005],1);
 const inside=result.geojson.features.filter(f=>booleanPointInPolygon(point([.005,.005]),f));
 expect(inside).toHaveLength(1);expect(inside[0].properties?.group).toBe("Residential med");
 const outside=result.geojson.features.filter(f=>booleanPointInPolygon(point([-.002,.005]),f));expect(outside[0].properties?.group).toBe("Ag/Rural");
 expect(flumGroup("RESIDENTIAL")).toBe("Residential (density unspecified)");
});
it("returns nearby projects in distance order with namespaced IDs",()=>{
 const result=combineRadiusCases([{area:AREAS.nampa,cases:[item("far",.008,0),item("near",.001,0)]}],[0,0],1);
 expect(result.map(c=>c.id)).toEqual(["nampa:near","nampa:far"]);expect(result[0].distance).toBeLessThan(result[1].distance);
});
