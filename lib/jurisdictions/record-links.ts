import type {JurisdictionDefinition} from "./types";
import type {Application} from "./adapters/types";
export function verificationUrl(d:JurisdictionDefinition,id:string){return d.recordLinks?.verifyUrlTemplate.replace("{recordId}",encodeURIComponent(id.replace(/'/g,"''")));}
export function sourceRecordId(d:JurisdictionDefinition,a:Application){return String(a.sourceFields[(d.applications.params.fields as Record<string,string>)?.id]??a.recordId);}
export function restrictedRecordData(d:JurisdictionDefinition,url:string,text:string,id:string){
 const policy=d.recordLinks;if(!policy||url!==verificationUrl(d,id))return false;
 try{const u=new URL(url),fields=(u.searchParams.get("outFields")??"").split(",");
  if(u.protocol!=="https:"||u.searchParams.get("f")!=="json"||!fields.includes(policy.idField)||fields.some(f=>!policy.dataFields.includes(f)||/applicant|owner|staff|planner|contact|email/i.test(f)))return false;
  const data=JSON.parse(text);return !data.error&&!data.exceededTransferLimit&&Array.isArray(data.features)&&data.features.length===1&&data.features[0].attributes?.[policy.idField]===id&&Object.keys(data.features[0].attributes).every(f=>fields.includes(f));
 }catch{return false;}
}
export function recordDataIssue(text:string,id:string){
 try{const rows=JSON.parse(text).features;if(Array.isArray(rows)&&rows.length!==1){const fields=[...new Set(rows.flatMap(r=>Object.keys(r.attributes??{})))].filter(key=>new Set(rows.map(r=>JSON.stringify(r.attributes?.[key]))).size>1);return `The county query returned ${rows.length} distinct source rows for ${id}; exactly one is required.${fields.length?" Public rows disagree on "+fields.join(", ")+".":""} Review the county record; LAW has not selected a conflicting row for publication.`;}}catch{}
 return "Restricted data query must return exactly one matching APPFILE with only configured public fields.";
}
export function officialDocument(d:JurisdictionDefinition,url:string){
 try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password&&(d.documents.officialPaths??[]).some(p=>u.hostname===p.host&&u.pathname.toLowerCase()===p.pathname.toLowerCase()&&Object.entries(p.query??{}).every(([k,v])=>u.searchParams.get(k)===v));}catch{return false;}
}
export function documentFilename(url:string){try{const u=new URL(url);return decodeURIComponent(u.searchParams.get("doc")??u.pathname).split(/[\\/]/).at(-1)??"";}catch{return "";}}
export function filenameIdentifies(d:JurisdictionDefinition,url:string,ids:string[]){
 const name=documentFilename(url);return officialDocument(d,url)&&ids.some(id=>new RegExp("(?:^|[^0-9])"+id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?=$|[^0-9])","i").test(name));
}
