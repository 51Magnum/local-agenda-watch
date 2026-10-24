import { booleanPointInPolygon, point } from "@turf/turf";
import {liveAreasInRadius} from "@/lib/maps/radius";
import { AREAS } from "./registry";
export function areasAtPoint(coordinates:[number,number]){return Object.values(AREAS).filter(a=>booleanPointInPolygon(point(coordinates),a.coverageBoundary??a.boundary)).sort((a,b)=>Number(b.status==="live")-Number(a.status==="live")||Number(a.type==="county")-Number(b.type==="county"));}
export function liveAreaAtPoint(coordinates:[number,number]){return areasAtPoint(coordinates).find(a=>a.status==="live");}
export function locationMapUrl(coordinates:[number,number],address?:string,radius=1){const areas=liveAreasInRadius(coordinates,radius),area=areas.find(a=>a.type==="city")??areas[0];return area?`/${area.country}/${area.state}/map?`+new URLSearchParams({lat:coordinates[1].toFixed(6),lng:coordinates[0].toFixed(6),r:String(radius),nearby:"1",...(address?{q:address.slice(0,200)}:{})}):undefined;}
