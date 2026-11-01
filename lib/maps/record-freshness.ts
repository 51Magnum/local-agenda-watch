import type {EvidenceState} from "../timeline/types";
import type {ScheduleState} from "../timeline/schedule";
import type {HearingFeed} from "../localities/types";
import type {ProjectHearing} from "../projects";
/** Failed checks and checks for other records never advance this record's date. */
export function latestSuccessfulCheck(input:{areaId:string;caseIds:string[];state:EvidenceState;schedule:ScheduleState;feed?:HearingFeed;hearing?:ProjectHearing}){
 const {areaId,caseIds,state,schedule,feed,hearing}=input;
 const values=[...caseIds.map(id=>schedule.recordChecks?.[areaId]?.[id]),...Object.values(state.documents).filter(d=>(d.areaId??"nampa")===areaId&&d.state==="complete"&&!d.error&&d.caseIds.some(id=>caseIds.includes(id))).map(d=>d.checkedAt),hearing?.last_checked_at,...feed&&!feed.dataUnavailable&&!feed.scheduleUnavailable?[feed.refreshedAt,schedule.sweeps?.[areaId]?.lastSuccessAt]:[]];
 return values.filter((v):v is string=>!!v&&!Number.isNaN(Date.parse(v))).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);
}
