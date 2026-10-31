import type {AreaDefinition} from "./registry";
import {getArea} from "./public-registry";
export function coverageColor(area:AreaDefinition):string {
 if(area.status!=="live")return "#64748b";
 return area.color??getArea(area.id)?.color??"#64748b";
}
export function coverageLabel(area:AreaDefinition){return (area.type==="county"?"Unincorporated ":"")+area.name;}
