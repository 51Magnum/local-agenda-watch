import{FEATURED_AREA_ID,getArea,type AreaDefinition,type PublicArea}from"./public-registry";
export function displayArea(id?:string):PublicArea{return getArea(id??FEATURED_AREA_ID)??getArea(FEATURED_AREA_ID)!;}
export function areaDate(value:string,area:Pick<AreaDefinition,"timezone">,options:Intl.DateTimeFormatOptions={weekday:"long",month:"long",day:"numeric",year:"numeric"}){return new Intl.DateTimeFormat("en-US",{...options,timeZone:value.length===10?"UTC":area.timezone}).format(new Date(value.length===10?value+"T12:00:00Z":value));}
export function areaTime(value:string,area:Pick<AreaDefinition,"timezone">){return new Intl.DateTimeFormat("en-US",{timeZone:area.timezone,hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(value));}

/** Same public hearing label in panes, pages and meeting cards. Date-only records never invent a time. */
export function hearingDateTime(value:string,timezone="America/Denver"){
 const dateOnly=value.length===10,d=new Date(dateOnly?value+"T12:00:00Z":value);
 const day=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric",timeZone:dateOnly?"UTC":timezone}).format(d);
 if(dateOnly)return day;
 const time=new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",timeZone:timezone}).format(d).replace(":00","");
 return day+" · "+time+" "+(new Intl.DateTimeFormat("en-US",{timeZone:timezone,timeZoneName:"longGeneric"}).formatToParts(d).find(p=>p.type==="timeZoneName")?.value??"local time");
}

/** Format dates embedded in source timeline prose without exposing storage syntax. */
export function residentDateText(value:string,timezone="America/Denver"){
 return value.replace(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?\b/g,date=>Number.isNaN(Date.parse(date))?date:hearingDateTime(date,timezone)).replace(/America\/[A-Za-z_]+/g,zone=>new Intl.DateTimeFormat("en-US",{timeZone:zone,timeZoneName:"longGeneric"}).formatToParts(new Date()).find(p=>p.type==="timeZoneName")?.value??"local time").replace(/ agenda · /g," meeting agenda · ").replace(/; outcome not established/g,". A decision has not been verified in the available record.");
}
