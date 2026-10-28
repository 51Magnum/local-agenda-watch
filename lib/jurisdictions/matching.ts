import type {AgendaItem,Application} from "./adapters/types";
export type ApplicationMatch={recordId:string;method:"case"|"parcel"|"address";sourceUrl:string};
const words=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
/** Case IDs take precedence. Parcel/address fallbacks must identify exactly one record. */
export function matchApplications(item:AgendaItem,applications:Application[]):ApplicationMatch[]{
 const exact=applications.filter(a=>[a.recordId,...a.relatedCaseNumbers].some(id=>item.caseNumbers.includes(id)));
 if(exact.length)return exact.map(a=>({recordId:a.recordId,method:"case",sourceUrl:a.recordUrl}));
 const text=" "+words(item.title)+" ";
 const parcel=applications.filter(a=>a.parcel.some(p=>words(p).length>=6&&text.includes(" "+words(p)+" ")));
 if(parcel.length)return parcel.length===1?[{recordId:parcel[0].recordId,method:"parcel",sourceUrl:parcel[0].recordUrl}]:[];
 const address=applications.filter(a=>/^\d+\s+\D/.test(words(a.address))&&words(a.address).split(" ").length>=3&&text.includes(" "+words(a.address)+" "));
 return address.length===1?[{recordId:address[0].recordId,method:"address",sourceUrl:address[0].recordUrl}]:[];
}
