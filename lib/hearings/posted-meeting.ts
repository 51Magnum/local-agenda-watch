import {primeGovAdapter} from "./primegov";
import {hearingWithinDays} from "./presentation";
import type {ProjectHearing} from "../projects";
let cached:{until:number;adapter:ReturnType<typeof primeGovAdapter>;meetings:ReturnType<ReturnType<typeof primeGovAdapter>["load"]>}|undefined;
/** Read-only verification repairs a stale/missing match; no database or AI writes on page reads. */
export async function postedMeeting(areaId:string,caseId:string,next:ProjectHearing,now=new Date()){
 if(areaId!=="nampa"||!hearingWithinDays(next,"America/Denver",now))return;
 if(!cached||cached.until<now.getTime()){const adapter=primeGovAdapter();cached={until:now.getTime()+300000,adapter,meetings:adapter.load()};cached.meetings.catch(()=>{cached=undefined;});}
 const current=cached;
 const result=await current.adapter.match({areaId,caseId,caseIds:[caseId],body:next.body,startsAt:next.startsAt,timezone:"America/Denver"},await current.meetings);
 return {...result,last_checked_at:new Date(current.until-300000).toISOString()};
}
