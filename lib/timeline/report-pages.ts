import type {PageText} from "./types";
/** Keep a packet's contiguous case section; a multi-case contents page cannot establish ownership. */
export function caseReportPages(pages:PageText[],caseId:string,packet:boolean){
 if(!packet)return pages;let own=false;return pages.filter(p=>{const ids=[...new Set(p.text.match(/\b(?:[A-Z]{1,5}-\d{4}-\d{2,6}|[A-Z]{2,4}\d{4}-\d{2,5}(?:-(?:APL|MOD))?)\b/g)??[])];if(ids.length>3){own=false;return false;}if(ids.includes(caseId))own=true;else if(ids.length)own=false;return own;});
}
