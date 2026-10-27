import { parsePrimeGovAgenda, parsePrimeGovMeetings, NAMPA_PRIMEGOV_MEETINGS_URL } from "../sources/primegov";
import type { AgendaMeeting } from "../localities/types";
import type { HearingMeetingFields, HearingTarget } from "./types";
import { hearingBody, localHearingDate } from "./types";
import { NAMPA_PORTAL } from "./policies";

/** A numeric application ID is not an agenda item number. Ambiguous repeated matches stay empty. */
export function matchPrimeGovCaseNumber(text:string,caseIds:string[]) {
  const lines=text.replace(/-\s*\n\s*/g,"-").split(/\r?\n/);
  const ids=caseIds.map(id=>id.toUpperCase());
  let section:string|undefined,current:string|undefined;
  const found=new Set<string>();
  for(const line of lines){
    const full=line.match(/^\s*(\d{1,2})\.\s*([A-Z])\.\s*/);
    const top=line.match(/^\s*(\d{1,2})\.\s+/),letter=line.match(/^\s*([A-Z])\.\s+/);
    if(full){section=full[1];current=section+"."+full[2];}
    else if(top){section=top[1];current=section;}
    else if(letter)current=section?section+"."+letter[1]:letter[1];
    const cases=(line.match(/\b[A-Z]{2,6}-\d{5}-\d{4}\b/gi)??[]).map(id=>id.toUpperCase());
    if(cases.some(id=>ids.includes(id))&&current)found.add(current);
  }
  return found.size===1?[...found][0]:undefined;
}
async function request(url:string) {
  const response=await fetch(url,{headers:{Accept:"application/json,text/html,application/pdf"},signal:AbortSignal.timeout(12000),cache:"no-store"});
  if(!response.ok)throw Error("PrimeGov HTTP "+response.status);
  return response;
}
async function document(url:string):Promise<{kind:"html"|"pdf";text:string}|undefined> {
  const response=await fetch(url,{signal:AbortSignal.timeout(12000),cache:"no-store"});
  if(response.status===404)return;
  if(!response.ok)throw Error("PrimeGov document HTTP "+response.status);
  const length=Number(response.headers.get("content-length")??0);if(length>15000000)throw Error("PrimeGov document too large");
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>15000000)throw Error("PrimeGov document too large");
  const prefix=new TextDecoder().decode(bytes.slice(0,1000));
  if(prefix.startsWith("%PDF-")){
    const {extractNativePdfPages}=await import("../timeline/extract");
    const pages=await extractNativePdfPages(bytes);return {kind:"pdf",text:pages.map(p=>p.text).join("\n")};
  }
  const text=new TextDecoder().decode(bytes);
  if(/Document Not Found|Just a moment|Attention Required|<title>.*(?:Error|Not Found)/i.test(text))return;
  return {kind:"html",text};
}
async function publishedPacket(url:string) {
  const response=await fetch(url,{headers:{Range:"bytes=0-1023"},signal:AbortSignal.timeout(12000),cache:"no-store"});
  if(!response.ok){await response.body?.cancel();return false;}
  const reader=response.body?.getReader();if(!reader)return false;
  try{const first=await reader.read();return new TextDecoder().decode(first.value?.slice(0,32)).startsWith("%PDF-");}
  finally{await reader.cancel();}
}
export type HearingMeetingAdapter={load:()=>Promise<AgendaMeeting[]>;match:(target:HearingTarget,meetings:AgendaMeeting[])=>Promise<HearingMeetingFields>};
export function primeGovAdapter():HearingMeetingAdapter {
  const documents=new Map<string,Promise<Awaited<ReturnType<typeof document>>>>();
  const packets=new Map<string,Promise<boolean>>();
  const get=(url:string)=>{if(!documents.has(url))documents.set(url,document(url));return documents.get(url)!;};
  return {
    load:async()=>parsePrimeGovMeetings(await(await request(NAMPA_PRIMEGOV_MEETINGS_URL)).json()),
    match:async(target,meetings)=>{
      const matches=meetings.filter(m=>m.date===localHearingDate(target.startsAt,target.timezone)&&hearingBody(m.body)===hearingBody(target.body));
      if(matches.length>1)throw Error("Multiple official meetings match this hearing; admin review required");
      const meeting=matches[0];
      const base:HearingMeetingFields={meeting_url:NAMPA_PORTAL,meeting_datetime:target.startsAt,match_status:"awaiting-agenda"};
      if(!meeting)return base;
      const html=meeting.htmlAgendaUrl?await get(meeting.htmlAgendaUrl):undefined;
      const pdf=meeting.compiledAgendaUrl?await get(meeting.compiledAgendaUrl):undefined;
      const agenda=pdf?.kind==="pdf"?meeting.compiledAgendaUrl:html?.kind==="html"?meeting.htmlAgendaUrl:undefined;
      if(meeting.packetUrl&&!packets.has(meeting.packetUrl))packets.set(meeting.packetUrl,publishedPacket(meeting.packetUrl).catch(()=>false));
      const packet=meeting.packetUrl?await packets.get(meeting.packetUrl):false;
      const item=html?.kind==="html"?parsePrimeGovAgenda(html.text,meeting.htmlAgendaUrl!).filter(i=>i.caseIds.some(id=>target.caseIds.includes(id))):[];
      const itemNumber=pdf?.kind==="pdf"?matchPrimeGovCaseNumber(pdf.text,target.caseIds):undefined;
      return {...base,meeting_url:agenda?(html?.kind==="html"?meeting.htmlAgendaUrl:agenda):NAMPA_PORTAL,agenda_url:agenda,packet_url:packet?meeting.packetUrl:undefined,
        agenda_item_number:itemNumber??(item.length===1?item[0].itemNumber:undefined),match_status:agenda?"published":"awaiting-agenda",
        meeting_kind:/special/i.test(meeting.title)?"special":/regular/i.test(meeting.title)?"regular":undefined,
        time_subject_to_change:meeting.subjectToChange,
        speak_signup_url:agenda?meeting.meetingUrl??agenda:NAMPA_PORTAL,
      };
    },
  };
}
