import {cleanResidentTitle} from "../resident-copy";
/** Keep official prose intact; only the small navigation title is shortened. */
export function applicationTitle(type:string,description:string){
 const label=type?cleanResidentTitle(type):"",text=description.replace(/\S*\uFFFD\S*/g,"").replace(/\s+/g," ").trim();
 // Prefer a named subject anywhere in the proposal, rather than a list of procedures.
 const generic=/^(?:application|alternative|compliance|planned|unit|development|preliminary|plat|zoning|map|amendment|conditional|use|master|site|plan|comprehensive|approval|the|a|an)$/i;
 const names=[...text.matchAll(/\b([A-Z][\p{L}\p{N}'’-]*(?:\s+[A-Z][\p{L}\p{N}'’-]*){0,6}\s+(?:Subdivision|Sub|Event Center|Specific Area Plan|Winery|Business Park|Ranch|Center|Condominiums|Farmstead))\b/gu)].map(m=>m[1].split(" ").filter((word,index,all)=>!all.slice(0,index).every(w=>generic.test(w))||!generic.test(word)).join(" ")).filter(name=>name&&name.split(" ").some(word=>!generic.test(word)&&!/^subdivision|center|ranch$/i.test(word)));
 let subject=names.at(-1)??text;
 if(!names.length){
  const zone=text.match(/\bfrom\b[^.;]*?\bto\s+(?:an?\s+|the\s+)?([^.;]+?\bDistrict)\b/i);if(zone&&/rezone|zoning (?:map|ordinance) amendment/i.test(text))subject=zone[1];
  else{
   for(let i=0;i<3;i++)subject=subject.replace(/^(?:(?:an?\s+)?application\s+(?:(?:seeking|for|the)\s+)*|request\s+(?:for|to)\s+|seeking\s+approval\s+(?:of|for)\s+|(?:the\s+)?approval\s+(?:of|for)\s+|(?:proposed\s+)?amendment\s+to\s+|allow\s+for\s+|(?:an?|the)\s+)/i,"");
   const escaped=type.trim().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
   if(escaped)subject=subject.replace(new RegExp("^(?:updated\\s+)?"+escaped+"(?:\\s+and\\s+(?:partial\\s+)?Master Site Plan)?(?:\\s+(?:application|permit))?(?:\\s+(?:for|to|of))?\\s+","i"),"");
   subject=subject.replace(/^(?:an?|the)\s+/i,"");
  }
 }
 if(!names.length){
  const business=text.match(/\bfor use as\s+(?:an?\s+)?([^.;]+?)(?:\s+business\b|\s+with\b|[.;]|$)/i);
  const physical=text.match(/\b(?:[\d,]+\s+gallon\s+)?water storage tank\b|\bnatural gas(?: lateral)? pipeline\b|\banimal feeding operation\b/i);
  if(business)subject=business[1];else if(physical)subject=physical[0];
 }
 if(!names.length&&/master site plan/i.test(type)){const purpose=text.match(/\bfor\s+([^.;]+)\.?\s*$/i);if(purpose)subject=purpose[1];}
 if(!names.length){
  for(let i=0;i<3;i++)subject=subject.replace(/^(?:(?:seeking\s+)?approval\s+(?:of|for)\s+(?:an?\s+)?|seeking\s+approval\s+(?:of|for)\s+(?:an?\s+)?|administrative\s+modification\s+to\s+|updated\s+|(?:an?|the)\s+)/i,"");
  if(/plat|subdivision|planned unit development/i.test(type)){const lots=text.match(/\b\d+(?:\s*\(\d+\))?[- ]lot\s+[^.;]*?\bsubdivision\b/i);if(lots)subject=lots[0];}
 }
 subject=subject.replace(/^(?:updated|and|with(?: an?)?)\s+/i,"").replace(/^(?:allow\s+for\s+(?:an?\s+)?|(?:property|parcel)\s+consolidation\s+(?:to\s+)?)/i,"").split(/\.(?:\s|$)|\s+(?:along with|with a|of Section)\s+/i)[0].trim();
 const prefix=label?label+": ":"",seen=new Set(prefix.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[]);
 const unique=subject.split(/\s+/).filter(word=>{const key=word.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");if(seen.has(key))return false;seen.add(key);return true;}).join(" ");
 let bounded=unique.slice(0,Math.max(0,70-prefix.length));if(bounded.length<unique.length){bounded=bounded.replace(/\s+\S*$/,"");if(bounded.includes(","))bounded=bounded.slice(0,bounded.lastIndexOf(","));}
 for(let i=0;i<8;i++)bounded=bounded.replace(/(?:^|\s)(?:and|or|a|an|the|of|for|to|with|within|from|as|along|seeking|approval|single|family|master|site|planned|unit|in|existing|associated|known|approximately|additional|new)[,:;]?$/i,"").trim();
 return bounded?prefix+bounded.replace(/[,:;\s]+$/,""):label;
}
const typeLabels:Record<string,RegExp>={CPA:/comprehensive plan (?:amendment|map amendment)/i,ZC:/zoning map amendment|zone change|rezone/i,PUD:/planned unit development/i,S:/preliminary plat|subdivision/i,COM:/commercial (?:subdivision|plat)|subdivision/i,CU:/conditional use/i,A:/appeal/i,VAC:/vacation/i,V:/variance/i,MSP:/master site plan/i,HD:/hillside development/i,FP:/final plat/i,ALT:/alternative compliance/i,AC:/accessory use/i};
export const defaultTypeOrder=["CPA","ZC","PUD","S","COM","CU","A","VAC","V","MSP","HD","FP","ALT","AC"];
export function primaryType(a:{type:string;description:string;recordId:string;relatedCaseNumbers:string[]},order=defaultTypeOrder){
 const suffixes=new Set([a.recordId,...a.relatedCaseNumbers].flatMap(id=>id.split("-").slice(1)));
 for(const code of order.flatMap(value=>value.split("/"))){if(!suffixes.has(code))continue;const match=(a.type+" "+a.description).match(typeLabels[code]??/$^/);if(match)return match[0];}
 return a.type;
}
export function procedureTitleLabel(value:string){return Object.values(typeLabels).some(pattern=>value.match(pattern)?.[0].toLowerCase()===value.toLowerCase());}
