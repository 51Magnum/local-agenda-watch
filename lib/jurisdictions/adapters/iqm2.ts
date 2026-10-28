import {load} from "cheerio";
import {SourceHttp} from "../http";
import type {AgendaSource,JurisdictionDefinition} from "../types";
import {inSourceWindow} from "../types";
import {denverInstant} from "../../case-details";
import type {AgendaAdapter,Meeting} from "./types";
import {bodyKey,caseNumbers,clean,links} from "./common";
export function parseIqm2Calendar(html:string,config:JurisdictionDefinition,source:AgendaSource):Meeting[]{
 const $=load(html),base=String(source.params.baseUrl),result:Meeting[]=[];
 for(const el of $("a[href*='Detail_Meeting.aspx']").toArray()){
  const a=$(el),title=a.attr("title")??"",row=a.closest(".MeetingRow"),body=bodyKey(config,title.match(/Board:\s*([^\r\n]+)/i)?.[1]??row.find(".MeetingGroup").text());
  if(!body||/work\s*session/i.test(title+" "+row.text()))continue;
  const text=clean(a.text()),parsed=new Date(text);if(Number.isNaN(parsed.getTime()))continue;
  const date=parsed.getFullYear()+"-"+String(parsed.getMonth()+1).padStart(2,"0")+"-"+String(parsed.getDate()).padStart(2,"0");if(!source.bodies.includes(body)||!inSourceWindow(source,body,date))continue;
  const time=String(parsed.getHours()).padStart(2,"0")+":"+String(parsed.getMinutes()).padStart(2,"0"),url=new URL(a.attr("href")!,base).href,id=new URL(url).searchParams.get("ID")!;
  result.push({id,title:config.hearingBodies.find(b=>b.key===body)!.name,body,date,startsAt:denverInstant(date,time,config.timezone),meetingPageUrl:url,attachments:links($.html(row),base),items:[]});
 }
 return [...new Map(result.map(m=>[m.id,m])).values()];
}
export function parseIqm2Meeting(html:string,meeting:Meeting,config:JurisdictionDefinition):Meeting {
 const $=load(html),items:Meeting["items"]=[];
 for(const el of $("a[href*='Detail_LegiFile.aspx']").toArray()){
  const a=$(el),node=a.closest("tr,.AgendaItem,.Row"),title=clean(a.text()||node.text()),ids=caseNumbers(config,title);if(!ids.length)continue;
  const itemUrl=new URL(a.attr("href")!,meeting.meetingPageUrl).href,itemId=new URL(itemUrl).searchParams.get("ID")??ids.join("+");
  if(!items.some(i=>i.itemId===itemId))items.push({itemId,title,caseNumbers:ids,body:meeting.body,meetingDateTime:meeting.startsAt??meeting.date,meetingPageUrl:meeting.meetingPageUrl,itemUrl,attachments:links($.html(node),meeting.meetingPageUrl)});
 }
 return{...meeting,items,attachments:[...new Map([...meeting.attachments,...links(html,meeting.meetingPageUrl)].map(a=>[a.url,a])).values()]};
}
export function iqm2Adapter(config:JurisdictionDefinition,source:AgendaSource,http:SourceHttp):AgendaAdapter {
 const known=new Map<string,Meeting>(),base=String(source.params.baseUrl);
 return{listMeetings:async range=>{const rows=parseIqm2Calendar(await http.text(new URL("Calendar.aspx",base).href,{},12000000),config,source).filter(m=>m.date>=range.start&&m.date<=range.end);rows.forEach(m=>known.set(m.id,m));return rows;},getMeeting:async id=>{const meeting=known.get(id);if(!meeting)throw Error("List meetings before fetching details");const detail=parseIqm2Meeting(await http.text(meeting.meetingPageUrl,{},12000000),meeting,config);for(const item of detail.items)if(item.itemUrl){const html=await http.text(item.itemUrl,{},12000000);item.attachments=[...new Map([...item.attachments,...links(html,item.itemUrl)].map(a=>[a.url,a])).values()];}return detail;},healthcheck:async()=>{try{await http.text(new URL("Calendar.aspx",base).href,{},12000000);}catch{}return http.checks;}};
}
