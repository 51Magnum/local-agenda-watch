/** Shared cleanup for official titles; never fills missing proposal facts. */
export function titleCase(value:string){
 const lower=new Set(["a","an","and","at","for","in","of","on","or","the","to","with","from"]);
 return value.trim().split(/\s+/).map((w,i)=>/^(?:[A-Z]{1,5}(?:-[A-Z0-9]{1,6})+|[A-Z]{1,4}\d+|P&Z|LLC|ACHD|CUP|PUD|RS\d*)$/.test(w)?w:i&&lower.has(w.toLowerCase())?w.toLowerCase():/[a-z][A-Z]/.test(w)?w:w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");
}
export function cleanResidentTitle(value:string,fallback="Planning proposal"){
 const text=value.replace(/\bR\d{6,}\b/g,"").replace(/\b(?:ACTION ITEM|CHECKLIST|PUBLIC HEARING|CONSENT AGENDA)\b\s*[:–—-]?/gi,"").replace(/\b(?:staff planner|staff contact|planner|presented by)\b.*$/i,"").replace(/\b(?:[A-Z]{1,6}-\d{4}-\d{2,6}|[A-Z]{2,6}\d{4}-\d{2,6})(?:-(?:MOD|APL)\d*)?\b/g,"").replace(/\b(?:0,){2,}0\b/g,"").replace(/^\s*(?:[A-Z]\.|\d+[.)])\s*/,"").replace(/\(\s*\)|\[\s*\]/g,"").replace(/\s+[·|–—-]\s*$/g,"").replace(/\s{2,}/g," ").replace(/[.\s]+$/,"").trim();
 return titleCase((text&&text.length>2&&!/\.{3}|…$/.test(text)?text:fallback).replace(/^(?:a|an)\s+/i,""));
}
export function cleanResidentProse(value:string){return value.replace(/\b(?:ACTION ITEM|CHECKLIST)\b\s*[:–—-]?/gi,"").replace(/\b(?:0,){2,}0\b/g,"").replace(/\s+([.,;:])/g,"$1").replace(/\s{2,}/g," ").trim();}
export function readableLocation(value?:string){
 if(!value)return undefined;const s=cleanResidentProse(value);
 if(!s||/^(?:0[,\s]*)+$/.test(s)||/^(?:parcel|APN|tax lot|R\d{6,})\b/i.test(s)||/^(?:[A-Z]?\d{8,}[-,;\s]*)+$/.test(s)||/location.*(?:not confirmed|unknown)/i.test(s)||(/\b(?:parcel|APN|[A-Z]\d{6,})\b/i.test(s)&&!/(?:street|road|avenue|lane|blvd|drive|\brd\b|\bave\b|\bst\b|\bln\b)/i.test(s)))return undefined;
 return s.replace(/^0\s+(?=[A-Za-z])/,'');
}
