import {expect,it} from "vitest";
import {area,booleanPointInPolygon,point,feature,simplify} from "@turf/turf";
import {normalizeBoundaryGeometry} from "./boundary-geometry";
import {buildAreaBoundaries,boundaryVersion} from "./area-boundaries";
import {readReviewSnapshot} from "../jurisdictions/review-snapshot";
import {AREAS,legacyCoverageAreas,type AreaDefinition} from "../areas/registry";
import nampa from "../areas/boundaries/nampa.json";
import type {CaseGeometry} from "./types";
const square=(x:number,y:number,size:number):CaseGeometry=>({type:"Polygon",coordinates:[[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]]});
it("retains narrow rectangular holes instead of cutting diagonals through them",()=>{
 const shape:CaseGeometry={type:"Polygon",coordinates:[[[0,0],[.01,0],[.01,.01],[0,.01],[0,0]],[[.004,.004],[.0041,.004],[.0041,.006],[.004,.006],[.004,.004]]]};const normalized=normalizeBoundaryGeometry(shape);
 expect(area(feature(normalized))).toBeCloseTo(area(feature(shape)),4);
 for(const p of [[.00402,.0042],[.00408,.0058]])expect(booleanPointInPolygon(point(p),normalized)).toBe(false);
 expect(booleanPointInPolygon(point([.0039,.005]),normalized)).toBe(true);
});
it("dissolves overlapping parts and keeps disconnected islands",()=>{
 const a=square(0,0,.01),b=square(.005,0,.01),island=square(.03,.03,.001);const combined:CaseGeometry={type:"MultiPolygon",coordinates:[...(a.type==="Polygon"?[a.coordinates]:[]),...(b.type==="Polygon"?[b.coordinates]:[]),...(island.type==="Polygon"?[island.coordinates]:[])]};
 const normalized=normalizeBoundaryGeometry(combined);expect(normalized.type).toBe("MultiPolygon");expect(normalized.coordinates).toHaveLength(2);expect(booleanPointInPolygon(point([.0305,.0305]),normalized)).toBe(true);
});
it("preserves the official Nampa hole near East Amity and the railroad that coarse simplification fills",()=>{
 const hole=point([-116.5319234,43.5549725]),official=nampa as CaseGeometry;
 expect(booleanPointInPolygon(hole,official)).toBe(false);expect(booleanPointInPolygon(hole,simplify(feature(official),{tolerance:.0006}))).toBe(true);
 const payload=buildAreaBoundaries([{...AREAS.nampa,boundary:official}]);expect(booleanPointInPolygon(hole,payload.polygons.features[0])).toBe(false);
});
it("draws city limits while retaining broader planning coverage only in the mask",()=>{
 const city={...AREAS.nampa,boundary:square(0,0,1),coverageBoundary:square(0,0,3)} as AreaDefinition,payload=buildAreaBoundaries([city]),outsideCity=point([2,.5]);
 expect(booleanPointInPolygon(outsideCity,payload.polygons.features[0])).toBe(false);expect(payload.uncovered.features.some(f=>booleanPointInPolygon(outsideCity,f))).toBe(false);
 expect(boundaryVersion([city])).not.toBe(boundaryVersion([{...city,boundary:square(0,0,1.1)}]));
});

it("invalidates prepared geometry when a source changes and isolates caller mutations",()=>{
 const source=square(0,0,1),first=normalizeBoundaryGeometry(source);Object.assign(first,square(5,5,1));expect(booleanPointInPolygon(point([.5,.5]),normalizeBoundaryGeometry(source))).toBe(true);Object.assign(source,square(0,0,2));expect(booleanPointInPolygon(point([1.5,1.5]),normalizeBoundaryGeometry(source))).toBe(true);
});

it("keeps every outline and uncovered-mask ring non-degenerate for the live jurisdiction set",()=>{
 const areas=[...legacyCoverageAreas(),...(["ada-county","boise"].map(id=>readReviewSnapshot(id)!.area))],payload=buildAreaBoundaries(areas);for(const f of [...payload.polygons.features,...payload.uncovered.features])for(const p of f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates)for(const ring of p){expect(ring.length).toBeGreaterThanOrEqual(4);expect(new Set(ring.map(c=>c.join(","))).size).toBeGreaterThanOrEqual(3);expect(ring[0]).toEqual(ring.at(-1));}
});
