import { booleanPointInPolygon, point } from "@turf/turf";
import { AREAS,areaPath } from "./registry";
export function areasAtPoint(coordinates:[number,number]){return Object.values(AREAS).filter(a=>booleanPointInPolygon(point(coordinates),a.boundary)).sort((a,b)=>Number(b.status==="live")-Number(a.status==="live")||Number(a.type==="county")-Number(b.type==="county"));}
export function liveAreaAtPoint(coordinates:[number,number]){return areasAtPoint(coordinates).find(a=>a.status==="live");}
export function locationMapUrl(coordinates:[number,number]){const area=liveAreaAtPoint(coordinates);return area?areaPath(area)+"/map?"+new URLSearchParams({lat:coordinates[1].toFixed(6),lng:coordinates[0].toFixed(6),nearby:"1"}):undefined;}
