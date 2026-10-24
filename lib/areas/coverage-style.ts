import type {AreaDefinition} from "./registry";
const colors:Record<string,string>={nampa:"#2563eb",meridian:"#d97706",kuna:"#0f766e",star:"#db2777",middleton:"#7c3aed",eagle:"#0891b2"};
const palette=["#2563eb","#d97706","#0f766e","#db2777","#7c3aed","#0891b2","#4d7c0f"];
export function coverageColor(area:AreaDefinition):string {
 if(area.status!=="live")return "#64748b";
 if(area.type==="county")return "#334155";
 let hash=0;for(const char of area.id)hash=(hash*31+char.charCodeAt(0))>>>0;
 return colors[area.id]??palette[hash%palette.length];
}
export function coverageLabel(area:AreaDefinition){return (area.type==="county"?"Unincorporated ":"")+area.name;}
