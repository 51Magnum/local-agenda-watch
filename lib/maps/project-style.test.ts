import { expect, it } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { PROJECT_POLYGON_LAYERS } from "./project-style";
import { CASE_OUTLINE_ZOOM } from "./viewport";
it("accepts the actual polygon layers in MapLibre when outlines begin at zoom 14",()=>{
 const errors=validateStyleMin({version:8,sources:{"law-polygons":{type:"geojson",data:{type:"FeatureCollection",features:[]}}},layers:PROJECT_POLYGON_LAYERS});
 expect(errors.map(e=>e.message)).toEqual([]);
 expect(PROJECT_POLYGON_LAYERS.every(l=>l.minzoom===CASE_OUTLINE_ZOOM)).toBe(true);
});
