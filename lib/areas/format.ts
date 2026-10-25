import{FEATURED_AREA_ID,getArea,type AreaDefinition}from"./registry";
export function displayArea(id?:string):AreaDefinition{return getArea(id??FEATURED_AREA_ID)??getArea(FEATURED_AREA_ID)!;}
export function areaDate(value:string,area:AreaDefinition,options:Intl.DateTimeFormatOptions={weekday:"long",month:"long",day:"numeric",year:"numeric"}){return new Intl.DateTimeFormat("en-US",{...options,timeZone:value.length===10?"UTC":area.timezone}).format(new Date(value.length===10?value+"T12:00:00Z":value));}
export function areaTime(value:string,area:AreaDefinition){return new Intl.DateTimeFormat("en-US",{timeZone:area.timezone,hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(value));}

/** Same public hearing label in panes, pages and meeting cards. Date-only records never invent a time. */
export function hearingDateTime(value:string,timezone="America/Denver"){
 const dateOnly=value.length===10,d=new Date(dateOnly?value+"T12:00:00Z":value);
 const day=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric",timeZone:dateOnly?"UTC":timezone}).format(d);
 if(dateOnly)return day;
 const time=new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",timeZone:timezone}).format(d).replace(":00","");
 return day+" · "+time+" "+(timezone==="America/Denver"?"Mountain Time":timezone);
}
