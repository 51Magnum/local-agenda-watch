import {load} from "cheerio";
import {extractText} from "unpdf";
import {parseKunaArchive,parseStarMeetings,parseEagleMeetings} from "../../sources/municipal";
import {parseCountyMonth,parseCountyEvent} from "../../sources/canyon-county";
import {parseMeridianMeetings} from "../../sources/meridian";
import type {AgendaMeeting} from "../../localities/types";
import {SourceHttp} from "../http";
import type {AgendaSource,JurisdictionDefinition} from "../types";
import type {AgendaAdapter,Meeting} from "./types";
import {attachmentKind,bodyKey,caseNumbers,clean,links} from "./common";
type NoticeBlock={children:{text:string}[];markDefs?:{href?:string;fileUpload?:{asset:{_ref:string}}}[]};
type NoticePayload={result:{sections:{text:NoticeBlock[]}[]}[]};
/** Existing parser families are reused for another instance through source parameters. */
export function archiveAdapter(config:JurisdictionDefinition,source:AgendaSource,http:SourceHttp):AgendaAdapter {
 const base=String(source.params.baseUrl),known=new Map<string,Meeting>();
 const convert=(m:AgendaMeeting):Meeting|undefined=>{const body=bodyKey(config,m.body)||bodyKey(config,m.title);if(!body)return;return{id:m.id,title:m.title,body,date:m.date,meetingPageUrl:m.meetingUrl??m.sourceUrl,attachments:[...m.agendaUrl?[{title:"Agenda",url:m.agendaUrl,kind:"agenda" as const}]:[],...m.packetUrl?[{title:"Compiled packet",url:m.packetUrl,kind:"packet" as const}]:[],...m.minutesUrl?[{title:"Minutes",url:m.minutesUrl,kind:"minutes" as const}]:[]],items:m.items.map(i=>({itemId:i.itemNumber??i.title,title:i.title,caseNumbers:caseNumbers(config,i.title),body,meetingDateTime:m.date,meetingPageUrl:m.meetingUrl??m.sourceUrl,attachments:i.staffReports.map(a=>({title:a.label,url:a.url,kind:attachmentKind(a.label,a.url)}))}))};};
 return{listMeetings:async range=>{
  let meetings:Meeting[]=[];
  if(source.adapter==="civicplusArchive"){
   const series=source.params.archives as {body:string;agendaUrl:string}[];if(!series?.length)throw Error("Configure CivicPlus archive series per body");
   for(const s of series){const body=config.hearingBodies.find(b=>b.key===s.body);if(!body)throw Error("Unknown archive body");meetings.push(...parseKunaArchive(await http.text(s.agendaUrl),body.name,s.agendaUrl,"agenda").flatMap(m=>{const v=convert(m);return v?[v]:[];}));}
  }else if(source.adapter==="countyLandHearings"){
   const html=await http.text(base);for(const id of parseCountyMonth(html)){const url=new URL(String(source.params.eventPath??"Event/Details/{id}").replace("{id}",id),base).href;const event=parseCountyEvent(await http.text(url),id),body=bodyKey(config,event.body);if(!body||event.date<range.start||event.date>range.end)continue;meetings.push({id,title:event.name,body,date:event.date,startsAt:event.startsAt,meetingPageUrl:url,attachments:event.documents.map(a=>({title:a.label,url:a.url,kind:attachmentKind(a.label,a.url)})),items:[{itemId:id,title:event.name,caseNumbers:caseNumbers(config,event.name+" "+event.caseIds.join(" ")),body,meetingDateTime:event.startsAt??event.date,meetingPageUrl:url,attachments:event.documents.map(a=>({title:a.label,url:a.url,kind:attachmentKind(a.label,a.url)}))}]});}
  }else if(source.adapter==="sanityNotices"){
   const data=await http.json<NoticePayload>(String(source.params.noticesUrl??base));
   for(const page of data.result??[])for(const section of page.sections??[])for(const block of section.text??[]){const title=clean(block.children.map(c=>c.text).join("")),ids=caseNumbers(config,title);if(!ids.length)continue;for(const mark of block.markDefs??[]){const ref=mark.fileUpload?.asset._ref,url=mark.href??(ref&&source.params.assetBaseUrl?String(source.params.assetBaseUrl)+ref.replace(/^file-/,"").replace(/-pdf$/,".pdf"):undefined);if(!url)continue;const bytes=(await http.request(url)).bytes,text=(await extractText(new Uint8Array(bytes),{mergePages:true})).text,dateMatch=text.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/),body=bodyKey(config,text);if(!dateMatch||!body)continue;const date=dateMatch[3]+"-"+dateMatch[1].padStart(2,"0")+"-"+dateMatch[2].padStart(2,"0"),m:Meeting={id:body+date,title:config.hearingBodies.find(b=>b.key===body)!.name,body,date,meetingPageUrl:url,attachments:[{title:"Hearing notice",url,kind:"other"}],items:[{itemId:ids.join("+"),title,caseNumbers:ids,body,meetingDateTime:date,meetingPageUrl:url,attachments:[{title:"Hearing notice",url,kind:"other"}]}]};meetings.push(m);}}
  }else{
   const calendars=(source.params.calendars as {body:string;url:string}[]|undefined)??[{body:source.bodies[0],url:base}];
   for(const calendar of calendars){const html=await http.text(calendar.url);const parsed=source.adapter==="granicusPublisher"?parseEagleMeetings(html,calendar.url):source.adapter==="municipalClerk"?parseMeridianMeetings(html,config.hearingBodies.find(b=>b.key===calendar.body)!.name,calendar.url):parseStarMeetings(html,calendar.url);meetings.push(...parsed.flatMap(m=>{const v=convert(m);return v?[v]:[];}));}
  }
  meetings=[...new Map(meetings.filter(m=>m.date>=range.start&&m.date<=range.end).map(m=>[m.id,m])).values()];meetings.forEach(m=>known.set(m.id,m));return meetings;
 },getMeeting:async id=>{
  const m=known.get(id);if(!m)throw Error("List meetings first");if(m.items.length)return m;const agenda=m.attachments.find(a=>a.kind==="agenda");if(!agenda)return m;
  const r=await http.request(agenda.url,{},config.documents.maxBytes),prefix=new TextDecoder().decode(r.bytes.subarray(0,5));
  const text=prefix==="%PDF-"?(await extractText(new Uint8Array(r.bytes),{mergePages:true})).text:load(new TextDecoder().decode(r.bytes))("body").text();
  const lines=text.split(/\n+/).map(clean);for(const line of lines){const ids=caseNumbers(config,line);if(!ids.length)continue;m.items.push({itemId:ids.join("+"),title:line,caseNumbers:ids,body:m.body,meetingDateTime:m.date,meetingPageUrl:m.meetingPageUrl,attachments:prefix==="%PDF-"?[]:links(new TextDecoder().decode(r.bytes),agenda.url)});}return m;
 },healthcheck:async()=>{try{await http.text(base);}catch{}return http.checks;}};
}
