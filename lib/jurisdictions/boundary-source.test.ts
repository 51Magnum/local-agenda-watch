import {expect,it} from "vitest";
import {bbox} from "@turf/turf";
import type {FeatureCollection,Geometry} from "geojson";
import {verifyBoundarySource,collectionCoverage,boundarySourceMatches} from "./boundary-source";
import {jurisdiction} from "./registry";
import {stagedApplications} from "./resident-records";
import type {StagingSnapshot} from "./store";
import {snapshotHash} from "./snapshot-hash";
const d=jurisdiction("ada-county");
const rows=(names:string[]):FeatureCollection<Geometry|null>=>({type:"FeatureCollection",features:names.map(county_name=>({type:"Feature",properties:{county_name},geometry:null}))});
const snapshot:StagingSnapshot={areaId:d.id,launchStatus:"admin_only",checkedAt:"2026-10-28T00:00:00Z",range:{start:"2026-08-01",end:"2026-12-01"},complete:true,health:[],skipped:[],applications:[],meetings:[]};
it("selects exactly Ada, rejecting the regional seven-county source and a wrong single county",()=>{
 expect(d.boundary.where).toBe("county_name='Ada'");
 expect(()=>verifyBoundarySource(d.boundary,rows(["Ada"]))).not.toThrow();
 expect(()=>verifyBoundarySource(d.boundary,rows(["Canyon","Owyhee","Payette","Ada","Elmore","Gem","Boise"]))).toThrow(/feature count/);
 expect(()=>verifyBoundarySource(d.boundary,rows(["Canyon"]))).toThrow(/identity/);
});
it("falls back to the verified Ada cache when older staging has no boundary provenance",()=>{
 const coverage=collectionCoverage(d,snapshot)!;
 const bounds=bbox(coverage);
 expect(bounds[0]).toBeGreaterThan(-116.52);expect(bounds[2]).toBeLessThan(-115.97);
 expect(bounds[1]).toBeGreaterThan(43.1);expect(bounds[3]).toBeLessThan(43.81);
 expect(boundarySourceMatches(d,snapshot)).toBe(false);
 const apps=[[-116.2,43.35],[-116.8,43.6],[-116.2023,43.615]].map((coordinates,i)=>({recordId:`20260100${i}-CU`,relatedCaseNumbers:[],name:"Source proposal",type:"CU",status:"Active",address:"",parcel:[],description:"",recordUrl:"https://official.test",sourceUrl:"https://official.test",sourceFields:{},geometry:{type:"Point" as const,coordinates}}));
 expect(stagedApplications({...snapshot,applications:apps}).map(a=>a.recordId)).toEqual(["202601000-CU"]);
});
it("binds approval hashes to the selected official boundary query",()=>{
 const corrected={...snapshot,boundarySource:{url:d.boundary.url,where:d.boundary.where}};
 expect(boundarySourceMatches(d,corrected)).toBe(true);
 expect(snapshotHash(corrected)).not.toBe(snapshotHash(snapshot));
 expect(snapshotHash({...corrected,boundarySource:{url:d.boundary.url,where:"1=1"}})).not.toBe(snapshotHash(corrected));
});
