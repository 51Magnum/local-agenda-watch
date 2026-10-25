import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";
import { CASE_OUTLINE_ZOOM } from "./viewport";
export const PROJECT_FILL_OPACITY: ExpressionSpecification = ["interpolate",["linear"],["zoom"],11,.58,13,.32,15,.14];
export const PROJECT_POLYGON_LAYERS: LayerSpecification[] = [
 {id:"law-fill",type:"fill",source:"law-polygons",minzoom:CASE_OUTLINE_ZOOM,paint:{"fill-color":["get","color"],"fill-opacity":PROJECT_FILL_OPACITY}},
 {id:"law-halo",type:"line",source:"law-polygons",minzoom:CASE_OUTLINE_ZOOM,paint:{"line-color":"#ffffff","line-width":["interpolate",["linear"],["zoom"],CASE_OUTLINE_ZOOM,3.5,CASE_OUTLINE_ZOOM+2,6]}},
 {id:"law-outline",type:"line",source:"law-polygons",minzoom:CASE_OUTLINE_ZOOM,paint:{"line-color":["get","color"],"line-width":["interpolate",["linear"],["zoom"],CASE_OUTLINE_ZOOM,1.5,CASE_OUTLINE_ZOOM+2,3]}},
 {id:"law-approximate",type:"line",source:"law-polygons",minzoom:CASE_OUTLINE_ZOOM,filter:["==",["get","approximate"],true],paint:{"line-color":"#ffffff","line-width":2,"line-dasharray":[3,2]}}
];
