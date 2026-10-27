import {load} from "cheerio";
import {SourceHttp} from "../http";
import type {AgendaSource,JurisdictionDefinition} from "../types";
import {inSourceWindow} from "../types";
import {denverInstant} from "../../case-details";
import type {AgendaAdapter,Meeting,Attachment} from "./types";
import {attachmentKind,bodyKey,caseNumbers,clean,links,sourceDate} from "./common";
type CalendarRow={ID:string;MeetingName:string;StartDate:string;MeetingDocumentLink?:{Type:string;Title?:string;Format?:string;Url?:string;URL?:string;Link?:string}[]};
export function parseEscribeCalendar(rows:CalendarRow[],config:JurisdictionDefinition,source:AgendaSource):Meeting[]{
 const base=String(source.params.baseUrl);return rows.flatMap(r=>{
  const body=bodyKey(config,r.MeetingName);if(!body||/work\s*session/i.test(r.MeetingName))return [];
  const date=sourceDate(r.StartDate,config.timezone);if(!source.bodies.includes(body)||!inSourceWindow(source,body,date))return [];
  const time=r.StartDate.match(/[ T](\d{2}:\d{2})/)?.[1];
  return [{id:r.ID,title:clean(r.MeetingName),body,date,startsAt:time?denverInstant(date,time,config.timezone):undefined,meetingPageUrl:base+"/Meeting.aspx?Id="+encodeURIComponent(r.ID)+"&Agenda=Agenda&lang=English",attachments:(r.MeetingDocumentLink??[]).flatMap(d=>{const href=d.Url??d.URL??d.Link;if(!href||d.Format==="HTML")return [];const url=new URL(href,base).href,title=d.Title??d.Type;return[{title,url,kind:attachmentKind(title,url)}];}),items:[]}];
 });
}
export function parseEscribeMeeting(html:string,meeting:Meeting,config:JurisdictionDefinition):Meeting {
 const $=load(html);const items:Meeting["items"]=[];
 const candidates=$("[id*='AgendaItem'],.AgendaItem,.agenda-item,.MeetingItem,.meeting-item").toArray();
 const nodes=candidates.length?candidates:$("a[href*='FileStream.ashx']").toArray().map(el=>$(el).closest("li,section,article,tr,div")[0]).filter(Boolean);
 for(const el of nodes){const node=$(el),title=clean(node.find("h2,h3,h4,.AgendaItemTitle,.agenda-item-title").first().text()||node.text());const ids=caseNumbers(config,title);if(!ids.length)continue;
  const attachments=links($.html(el),meeting.meetingPageUrl);const itemId=node.attr("id")??ids.join("+");
  if(items.some(i=>i.caseNumbers.join()==ids.join()&&i.attachments.some(a=>attachments.some(b=>b.url===a.url))))continue;
  items.push({itemId,title,caseNumbers:ids,body:meeting.body,meetingDateTime:meeting.startsAt??meeting.date,meetingPageUrl:meeting.meetingPageUrl,attachments});
 }
 // Some eSCRIBE layouts expose only attachment filenames; retain those as item facts.
 for(const a of links(html,meeting.meetingPageUrl)){const ids=caseNumbers(config,a.title);if(ids.length&&!items.some(i=>i.attachments.some(d=>d.url===a.url)))items.push({itemId:ids.join("+")+":"+a.url,title:a.title,caseNumbers:ids,body:meeting.body,meetingDateTime:meeting.startsAt??meeting.date,meetingPageUrl:meeting.meetingPageUrl,attachments:[a]});}
 const attachments:Attachment[]=[...new Map([...meeting.attachments,...links(html,meeting.meetingPageUrl)].map(a=>[a.url,a])).values()];return{...meeting,items,attachments};
}
export function escribeAdapter(config:JurisdictionDefinition,source:AgendaSource,http:SourceHttp):AgendaAdapter {
 const known=new Map<string,Meeting>(),base=String(source.params.baseUrl);
 return{listMeetings:async range=>{const result=await http.json<{d:CalendarRow[]|string}>(base+"/MeetingsCalendarView.aspx/GetCalendarMeetings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({calendarStartDate:range.start,calendarEndDate:range.end})});const rows=typeof result.d==="string"?JSON.parse(result.d):result.d;if(!Array.isArray(rows))throw Error("Invalid eSCRIBE calendar response");const meetings=parseEscribeCalendar(rows,config,source).filter(m=>m.date>=range.start&&m.date<=range.end);meetings.forEach(m=>known.set(m.id,m));return meetings;},getMeeting:async id=>{const m=known.get(id);if(!m)throw Error("List the meeting first to verify its body and date");return parseEscribeMeeting(await http.text(m.meetingPageUrl,{},12000000),m,config);},healthcheck:async()=>{try{await http.text(base,{},12000000);}catch{}return http.checks;}};
}
