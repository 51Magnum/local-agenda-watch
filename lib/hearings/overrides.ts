import { AREAS } from "../areas/registry";
import type { HearingMatchRow } from "./types";
export const HEARING_OVERRIDE_FIELDS=["meeting_url","agenda_url","packet_url","agenda_item_number","comment_deadline","comment_deadline_source_url","speak_signup_url"] as const;
export function validateHearingOverride(areaId:string,form:FormData):HearingMatchRow["override"] {
  const area=AREAS[areaId];if(!area||area.status!=="live")throw Error("Choose a covered area");
  if(form.get("mode")==="automatic")return {};
  const result:HearingMatchRow["override"]={};
  const allowed=new Set((area.timeline?.hosts??[]).map(h=>h.toLowerCase()));
  for(const value of Object.values(area.sources))try{if(typeof value==="string")allowed.add(new URL(value).hostname.toLowerCase());}catch{}
  for(const field of HEARING_OVERRIDE_FIELDS){
    const value=String(form.get(field)??"").trim();
    if(!value){result[field]=null;continue;}
    if(value.length>2000)throw Error("Meeting field too long");
    if(field.endsWith("_url")){
      const url=new URL(value);if(url.protocol!=="https:"||url.username||url.password||!allowed.has(url.hostname.toLowerCase()))throw Error("Use an official jurisdiction HTTPS link");
      result[field]=url.href;
    }else if(field==="comment_deadline"){
      if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error("Use an ISO deadline with a timezone, or a date-only deadline");
      result[field]=value;
    }else{
      if(!/^[A-Z0-9.()-]{1,24}$/i.test(value))throw Error("Enter a published agenda item number");result[field]=value;
    }
  }
  if(result.comment_deadline&&!result.comment_deadline_source_url)throw Error("A comment deadline requires its source URL");
  result.match_status=result.agenda_url||typeof result.meeting_url==="string"&&!/\/public\/portal\/?(?:$|\?)/i.test(result.meeting_url)?"published":"awaiting-agenda";
  return result;
}
