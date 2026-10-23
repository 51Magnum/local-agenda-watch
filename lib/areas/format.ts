import{FEATURED_AREA_ID,getArea,type AreaDefinition}from"./registry";
export function displayArea(id?:string):AreaDefinition{return getArea(id??FEATURED_AREA_ID)??getArea(FEATURED_AREA_ID)!;}
export function areaDate(value:string,area:AreaDefinition,options:Intl.DateTimeFormatOptions={weekday:"long",month:"long",day:"numeric",year:"numeric"}){return new Intl.DateTimeFormat("en-US",{...options,timeZone:value.length===10?"UTC":area.timezone}).format(new Date(value.length===10?value+"T12:00:00Z":value));}
export function areaTime(value:string,area:AreaDefinition){return new Intl.DateTimeFormat("en-US",{timeZone:area.timezone,hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(value));}
