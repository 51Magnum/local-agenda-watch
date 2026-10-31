import {cleanResidentTitle} from "../resident-copy";
/** Keep official prose intact; only the small navigation title is shortened. */
export function applicationTitle(type:string,description:string){
 const label=type?cleanResidentTitle(type):"";
 let subject=description.replace(/^\s*(?:an?\s+)?application\s+(?:for\s+)?(?:approval\s+(?:of|for)\s+)?/i,"").replace(/^\s*request\s+(?:for|to)\s+(?:an?\s+)?(?:updated\s+)?/i,"").replace(/\s+/g," ").trim().replace(/^(?:a|an)\s+/i,"");
 const escaped=type.trim().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 if(escaped)subject=subject.replace(new RegExp("^"+escaped+"(?:\\s+and\\s+(?:partial\\s+)?Master Site Plan)?(?:\\s+(?:application|permit))?(?:\\s+(?:for|to))?\\s+","i"),"");
 subject=subject.replace(/^(?:approval\s+(?:of|for)\s+|allow\s+for\s+|with\s+)?(?:an?\s+)?/i,"");
 const first=subject.split(/\.(?:\s|$)/)[0];
 const value=first?(label?label+": ":"")+first:label;
 if(value.length<=70)return value;
 const bounded=value.slice(0,69).replace(/\s+\S*$/,"").replace(/[,:;\s]+$/,"");
 return bounded;
}
const typeLabels:Record<string,RegExp>={CPA:/comprehensive plan (?:amendment|map amendment)/i,ZC:/zoning map amendment|zone change|rezone/i,PUD:/planned unit development/i,S:/preliminary plat|subdivision/i,COM:/commercial (?:subdivision|plat)|subdivision/i,CU:/conditional use/i,A:/appeal/i,VAC:/vacation/i,V:/variance/i,MSP:/master site plan/i,HD:/hillside development/i,FP:/final plat/i,ALT:/alternative compliance/i,AC:/accessory use/i};
export const defaultTypeOrder=["CPA","ZC","PUD","S","COM","CU","A","VAC","V","MSP","HD","FP","ALT","AC"];
export function primaryType(a:{type:string;description:string;recordId:string;relatedCaseNumbers:string[]},order=defaultTypeOrder){
 const suffixes=new Set([a.recordId,...a.relatedCaseNumbers].flatMap(id=>id.split("-").slice(1)));
 for(const code of order.flatMap(value=>value.split("/"))){if(!suffixes.has(code))continue;const match=(a.type+" "+a.description).match(typeLabels[code]??/$^/);if(match)return match[0];}
 return a.type;
}
export function procedureTitleLabel(value:string){return Object.values(typeLabels).some(pattern=>value.match(pattern)?.[0].toLowerCase()===value.toLowerCase());}
