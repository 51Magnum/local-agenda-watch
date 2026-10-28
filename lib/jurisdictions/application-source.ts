import type {JurisdictionDefinition} from "./types";
export function applicationRecordUrl(d:JurisdictionDefinition,recordId:string,projectNumber?:string){
 const key=d.applications.params.projectKey as {pattern:string}|undefined;
 const project=projectNumber??(key?recordId.match(new RegExp(key.pattern))?.[0]:undefined)??recordId;
 const template=d.applications.recordUrlTemplate;
 if(template)return template.replace("{recordId}",encodeURIComponent(recordId)).replace("{projectNumber}",encodeURIComponent(project));
 const source=String(d.applications.params.url??"");
 if(/\/(?:MapServer|FeatureServer)\/\d+\/?$/i.test(source)){
  const field=(d.applications.params.fields as Record<string,string>)?.id;
  if(!field||!/^\w+$/.test(field))throw Error("Case-specific source field is required");
  return source.replace(/\/$/,"")+"/query?"+new URLSearchParams({where:field+"='"+recordId.replace(/'/g,"''")+"'",outFields:"*",f:"html"});
 }
 return source;
}
