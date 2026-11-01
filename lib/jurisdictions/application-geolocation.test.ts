import {readFileSync} from "node:fs";
import {expect,it,vi} from "vitest";
vi.mock("@turf/turf",async original=>{const actual=await original<typeof import("@turf/turf")>();return {...actual,intersect:vi.fn(actual.intersect)};});
import {intersect} from "@turf/turf";
import type {FeatureCollection} from "geojson";
import {coverageEligible,geolocateApplications,applicationMapLocation} from "./application-geolocation";
import {jurisdiction} from "./registry";
import type {Application,GisAdapter} from "./adapters/types";
import type {CaseGeometry} from "../maps/types";
const d=jurisdiction("boise"),fixture=(file:string)=>JSON.parse(readFileSync(new URL("./fixtures/"+file,import.meta.url),"utf8")) as FeatureCollection;
const app=(recordId:string,address=""):Application=>({recordId,relatedCaseNumbers:[],name:"Source proposal",description:"Source proposal",type:"Planning",status:"Active",address,parcel:[],sourceUrl:"https://official.test",recordUrl:"https://official.test",sourceFields:{RecordID:recordId}});
const box=(w:number,s:number,e:number,n:number):CaseGeometry=>({type:"Polygon",coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]});
it("keeps majority coverage with a city sliver, drops mostly-city parcels, and flags missing geometry",()=>{
 const coverage=box(0,0,10,10),a=app("CASE");
 expect(coverageEligible({...a,geometry:box(-.1,1,2,3)},coverage)).toBeDefined();
 expect(coverageEligible({...a,geometry:box(-9,1,1,3)},coverage)).toBeUndefined();
 expect(coverageEligible(a,coverage)).toMatchObject({locationVerification:"unverified"});
 expect(applicationMapLocation(coverageEligible(a,coverage)!)).toMatchObject({geometry:null,centroid:null,statusNote:"Location unverified"});
});
it("also permits the explicitly configured point-on-feature rule",()=>expect(coverageEligible({...app("CASE"),geometry:box(0,0,10,10)},box(4,0,6,10))).toBeDefined());
it("avoids expensive overlay work when the point-on-feature rule already establishes eligibility",()=>{
 vi.mocked(intersect).mockClear();expect(coverageEligible({...app("CASE"),geometry:box(1,1,2,2)},box(0,0,10,10))).toBeDefined();expect(intersect).not.toHaveBeenCalled();
});
it("joins recorded permit geometry through source child-case numbers",async()=>{
 const a={...app("PLN23-00040"),relatedCaseNumbers:["CVA24-00026"],sourceFields:{RecordID:"PLN23-00040",ChildRecords:"CVA24-00026"}},query=vi.fn().mockResolvedValue(fixture("boise-permit-geometry.json"));
 const [located]=await geolocateApplications(d,[a],{query} as unknown as GisAdapter);
 expect(located.geometry?.type).toBe("Polygon");expect(located.geometrySource).toBe("polygon");expect(located.locationVerification).toBe("verified");
 expect(query).toHaveBeenCalledWith(expect.stringContaining("FeatureServer/160"),expect.stringContaining("'CVA24-00026'"));expect(located.geometrySourceUrl).toContain("/query?");
});
it("uses one unique recorded civic-address match and labels it approximate",async()=>{
 const query=vi.fn().mockImplementation((url:string)=>Promise.resolve(url.includes("/160")?{type:"FeatureCollection",features:[]}:fixture("ada-address-point.json")));
 const [located]=await geolocateApplications(d,[app("PLN26-00100","150 N Capitol Boulevard")],{query} as unknown as GisAdapter);
 expect(located.geometry?.type).toBe("Point");expect(located.geometrySource).toBe("address-point");expect(located.locationVerification).toBe("approximate");
 const map=applicationMapLocation(located);expect(map.statusNote).toBe("Approximate (address point)");expect(map.source).toBe("none");expect(map.confidence).toBe("approximate");
 expect(query).toHaveBeenLastCalledWith(expect.stringContaining("Address_Points/FeatureServer/21"),"AddNum=150 AND UPPER(StName)='CAPITOL'");
});
it("leaves blank/citywide and ambiguous addresses unmapped",async()=>{
 const points=fixture("ada-address-point.json");points.features.push(points.features[0]);
 const query=vi.fn().mockImplementation((url:string)=>Promise.resolve(url.includes("/160")?{type:"FeatureCollection",features:[]}:points));
 const found=await geolocateApplications(d,[app("ONE",""),app("TWO","Citywide"),app("THREE","150 N Capitol Blvd")],{query} as unknown as GisAdapter);
 expect(found.every(a=>!a.geometry&&a.locationVerification==="unverified")).toBe(true);expect(query).toHaveBeenCalledTimes(2);
});
it("retains source records as deferred when a geometry endpoint fails",async()=>{
 const [found]=await geolocateApplications(d,[app("PLN26-00100")],{query:vi.fn().mockRejectedValue(new Error("Unavailable"))} as unknown as GisAdapter);
 expect(found.recordId).toBe("PLN26-00100");expect(found.geolocationDeferred).toBe(true);expect(found.locationVerification).toBe("unverified");
});
it("batches civic addresses while keeping exact per-record matches and provenance",async()=>{
 const fallback=d.applications.params.addressPointFallback as {url:string;fields:{number:string;street:string;direction:string;suffix:string}},f=fallback.fields;
 const points:FeatureCollection={type:"FeatureCollection",features:Array.from({length:26},(_,i)=>({type:"Feature",geometry:{type:"Point",coordinates:[-116.2,43.6]},properties:{[f.number]:150+i,[f.street]:"CAPITOL",[f.direction]:"N",[f.suffix]:"BLVD"}}))};
 const query=vi.fn(async(url:string)=>url===fallback.url?points:{type:"FeatureCollection",features:[]} as FeatureCollection);
 const located=await geolocateApplications(d,Array.from({length:26},(_,i)=>app("PLN26-"+String(i).padStart(5,"0"),(150+i)+" N Capitol Boulevard")),{query} as unknown as GisAdapter);
 expect(query.mock.calls.filter(([url])=>url===fallback.url)).toHaveLength(2);expect(located.every(a=>a.locationVerification==="approximate")).toBe(true);
 expect(new URL(located[0].geometrySourceUrl!).searchParams.get("where")).toBe("AddNum=150 AND UPPER(StName)='CAPITOL'");
});
