import type { ProjectHearing } from "../projects";
import { AREAS } from "../areas/registry";
import { effectiveHearingFields, readHearingMatch } from "./store";
import { hearingKey } from "./types";
import { enrichHearing } from "./policies";

export async function resolveHearingMeeting(areaId:string,caseId:string,next:ProjectHearing):Promise<ProjectHearing> {
  next={...next,meeting_body:next.meeting_body??(AREAS[areaId].name+" "+next.body),meeting_url:next.meeting_url??next.agendaUrl??AREAS[areaId].sources.agendas,match_status:next.match_status??(next.meeting_url||next.agendaUrl?"published":"awaiting-agenda")};
  const key=hearingKey({body:next.body,startsAt:next.startsAt,timezone:AREAS[areaId].timezone});
  try{
    const row=await readHearingMatch(areaId,caseId,key);
    const result=enrichHearing(areaId,next,row?effectiveHearingFields(row):undefined);
    for(const [field,value]of Object.entries(row?.override??{}))if(value===null){
      delete (result as unknown as Record<string,unknown>)[field];
      if(field==="agenda_url")delete result.agendaUrl;
      if(field==="packet_url")delete result.packetUrl;
      if(field==="comment_deadline")delete result.commentDeadline;
      if(field==="comment_deadline_source_url")delete result.commentSourceUrl;
    }
    if(!result.comment_deadline_source_url){delete result.comment_deadline;delete result.commentDeadline;}
    return result;
  }catch{
    console.warn("[hearing-links] Match storage unavailable",areaId,caseId);
    return enrichHearing(areaId,next);
  }
}
