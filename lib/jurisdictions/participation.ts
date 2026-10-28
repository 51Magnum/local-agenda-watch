import {denverInstant} from "../case-details";
import type {JurisdictionDefinition} from "./types";
export function computeDeadlines(config:JurisdictionDefinition,date:string,body:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Hearing date must be a local calendar date");
 return config.participation.deadlineRules.filter(r=>!r.bodyKeys||r.bodyKeys.includes(body)).map(r=>{
  const [day,time]=r.rule.split(" "),d=new Date(date+"T12:00:00Z");
  if(day!=="SAME_DAY"){const target=day==="THU_BEFORE"?4:day==="MON_BEFORE"?1:undefined;if(target===undefined)throw Error("Unsupported deadline rule "+r.rule);let delta=(d.getUTCDay()-target+7)%7;if(delta===0)delta=7;d.setUTCDate(d.getUTCDate()-delta);}
  const localDate=d.toISOString().slice(0,10),exact=r.timeVerified&&/^\d{2}:\d{2}$/.test(time);
  return{kind:r.kind,date:localDate,startsAt:exact?denverInstant(localDate,time,config.timezone):undefined,label:time==="COB"?"Close of business (clock time not verified)":time==="DATE_ONLY"?"Registration date; confirm the cutoff time":time,sourceUrl:r.sourceUrl};
 });
}
