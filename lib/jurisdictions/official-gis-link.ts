/** Resident verification links open data queries, rather than often-blocked layer landing pages. */
export function officialGisLink(url:string|undefined,where="1=1"){
 if(!url||!/(?:MapServer|FeatureServer)\/\d+\/?$/i.test(url))return url;
 return url.replace(/\/$/,"")+"/query?"+new URLSearchParams({where,outFields:"*",outSR:"4326",f:"pjson"});
}
export function officialFeatureLink(url:string|undefined,properties:Record<string,unknown>|null,id?:string|number){
 const objectId=properties?.OBJECTID??properties?.ObjectID??id;
 return officialGisLink(url,typeof objectId==="number"||typeof objectId==="string"&&/^\d+$/.test(objectId)?"OBJECTID="+objectId:"1=1");
}
