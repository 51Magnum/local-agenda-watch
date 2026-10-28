import {expect,it} from "vitest";
import type {FeatureCollection,Geometry} from "geojson";
import {previewMapData} from "./preview-map-data";
const empty:FeatureCollection={type:"FeatureCollection",features:[]};
it("frames verified projects and preserves their click identity",()=>{
 const cases:FeatureCollection={type:"FeatureCollection",features:[{type:"Feature",properties:{areaId:"ada-county",caseId:"verified",color:"#3f6212"},geometry:{type:"Polygon",coordinates:[[[-116.4,43.5],[-116.39,43.5],[-116.39,43.51],[-116.4,43.51],[-116.4,43.5]]]}}]};
 const result=previewMapData(empty,cases);
 expect(result.markers.features).toHaveLength(1);expect(result.markers.features[0].properties?.caseId).toBe("verified");
 expect(result.markers.features[0].geometry.coordinates[0]).toBeCloseTo(-116.395);expect(result.bounds?.[0][1]).toBeCloseTo(43.505);
});
it("does not invent marker locations for unlocated cases",()=>{
 const cases:FeatureCollection<Geometry|null>={type:"FeatureCollection",features:[{type:"Feature",properties:{areaId:"boise",caseId:"unmapped"},geometry:null}]};
 expect(previewMapData(empty,cases)).toEqual({markers:empty,bounds:undefined});
});
