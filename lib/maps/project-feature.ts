import type {Feature} from "geojson";
import type {CaseGeometry} from "./types";
/** Every polygon part and worker/tile copy inherits the same canonical case ID. */
export function projectPolygonFeature(id:string,geometry:CaseGeometry,properties:Record<string,unknown>):Feature<CaseGeometry>{
 return {type:"Feature",id:String(id),geometry,properties:{...properties,id:String(id)}};
}
