import {extractText} from "unpdf";
import {SourceHttp} from "../http";
import type {AgendaSource,JurisdictionDefinition} from "../types";
import type {AgendaAdapter,Meeting,Attachment} from "./types";
import {attachmentKind,caseNumbers} from "./common";
export type BrowseFile={name:string;filterPath:string;isFile:boolean;size:number;fullPath?:string;imageUrl?:string};
/** Parse the published JSON array as data. Never evaluate embedded JavaScript. */
export function parseAdaFiles(html:string):BrowseFile[]{
 const anchor=html.indexOf('"fileSystemData"'),start=html.indexOf("[",anchor);if(anchor<0||start<0)throw Error("Ada file tree not present");
 let depth=0,quoted=false,escape=false,end=-1;
 for(let i=start;i<html.length;i++){const c=html[i];if(quoted){if(escape)escape=false;else if(c==="\\")escape=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='[')depth++;else if(c===']'&&--depth===0){end=i+1;break;}}
 if(end<0)throw Error("Incomplete Ada file tree");const rows=JSON.parse(html.slice(start,end)) as BrowseFile[];
 return rows.filter(r=>r.isFile&&/\.pdf$/i.test(r.name)&&/^\\\d{4}\\/.test(r.filterPath)&&!r.filterPath.includes("..")&&!/sign.?in|attendance/i.test(r.name));
}
export function adaMeetings(files:BrowseFile[],config:JurisdictionDefinition,source:AgendaSource):Meeting[]{
 const base=String(source.params.baseUrl),papp=String(source.params.papp);if(papp!=="DS_Agendas")throw Error("Only the Development Services land-use archive is supported");
 const url=(f:BrowseFile)=>new URL("Home/OpenDocument?"+new URLSearchParams({doc:f.filterPath+f.name,papp}),base).href;
 const meetings:Meeting[]=[];
 for(const f of files){const m=f.name.match(/(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{4})[-_ ]+(BOCC|PZC)[-_ ]*AGENDA/i);if(!m)continue;
  const date=m[3]+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0"),body=m[4].toLowerCase();if(!source.bodies.includes(body))continue;
  const attachments:Attachment[]=files.filter(d=>d.filterPath===f.filterPath).map(d=>({title:d.name,url:url(d),kind:attachmentKind(d.name),sizeBytes:d.size}));
  const meetingPageUrl=url(f),items=attachments.filter(a=>a.kind!=="agenda").flatMap(a=>{const ids=caseNumbers(config,a.title);return ids.length?[{itemId:a.title,title:a.title,caseNumbers:ids,body,meetingDateTime:date,meetingPageUrl,attachments:[a]}]:[];});
  meetings.push({id:body+":"+date,title:config.hearingBodies.find(b=>b.key===body)!.name,body,date,meetingPageUrl,attachments,items});
 }
 return [...new Map(meetings.map(m=>[m.id,m])).values()];
}
export function adaFileBrowseAdapter(config:JurisdictionDefinition,source:AgendaSource,http:SourceHttp):AgendaAdapter{
 const base=String(source.params.baseUrl),known=new Map<string,Meeting>();
 return{listMeetings:async range=>{const html=await http.text(base+"?papp="+encodeURIComponent(String(source.params.papp)),{},12000000),meetings=adaMeetings(parseAdaFiles(html),config,source).filter(m=>m.date>=range.start&&m.date<=range.end);meetings.forEach(m=>known.set(m.id,m));return meetings;},getMeeting:async id=>{const meeting=known.get(id);if(!meeting)throw Error("List meetings before fetching details");const result=await http.request(meeting.meetingPageUrl,{},config.documents.maxBytes);if(new TextDecoder().decode(result.bytes.subarray(0,5))!=="%PDF-")throw Error("Agenda download is not a PDF");const text=(await extractText(result.bytes.slice(),{mergePages:true})).text;for(const number of caseNumbers(config,text))if(!meeting.items.some(i=>i.caseNumbers.includes(number)))meeting.items.push({itemId:number,title:number,caseNumbers:[number],body:meeting.body,meetingDateTime:meeting.date,meetingPageUrl:meeting.meetingPageUrl,attachments:[]});return meeting;},healthcheck:async()=>{try{await http.text(base+"?papp=DS_Agendas",{},12000000);}catch{}return http.checks;}};
}
