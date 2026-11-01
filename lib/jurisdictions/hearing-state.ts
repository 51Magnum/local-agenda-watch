import {areaDate} from "../areas/format";
import type {JurisdictionDefinition} from "./types";
import type {Meeting} from "./adapters/types";
import {computeDeadlines} from "./participation";
export function jurisdictionToday(timezone:string,now=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function projectHearingState(d:JurisdictionDefinition,appearances:Meeting[],checkedAt:string,today=jurisdictionToday(d.timezone)){
 const next=appearances.filter(m=>!m.tentative&&m.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
 const sources=[{label:"Official hearings and agendas",url:d.participation.hearingsUrl},{label:"Legal notices",url:d.participation.legalNoticesUrl}].filter((s):s is {label:string;url:string}=>!!s.url);
 return {next,deadlines:next?computeDeadlines(d,next.date,next.body):[],commentUrl:next?(next.testimonySignupUrl??d.participation.testimonySignupUrl??next.meetingPageUrl):undefined,noHearing:next?undefined:{message:"No hearing scheduled in official agendas as of "+areaDate(checkedAt,{timezone:d.timezone})+".",sources}};
}
