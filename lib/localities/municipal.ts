import {unstable_cache} from "next/cache";
import {createHash} from "node:crypto";
import {extractText} from "unpdf";
import {geoQuery} from "@/lib/maps/gis";
import {readSourceFeed,saveSourceFeed} from "./source-cache";
import type {AgendaMeeting,HearingFeed,Locality} from "./types";
import {MUNICIPAL_IDS,MUNICIPAL_SOURCES,type MunicipalId} from "@/lib/sources/municipal-config";
import {municipalCaseIds,municipalFromFeature,parseKunaArchive,parseStarMeetings,parseEagleMeetings,parseMunicipalAgenda,addAgendaCases,composeMunicipalFeed,humanDate,clock,clean,type MunicipalCase} from "@/lib/sources/municipal";
import type {RecordDocument} from "./record-types";
type PdfCache=Record<string,{hash:string;text:string}>;
type MunicipalFeed=HearingFeed&{pdfCache?:PdfCache};
const HEADERS={Accept:"text/html,application/pdf,application/json","User-Agent":"Mozilla/5.0 LocalAgendaWatch/1.0"};
async function response(url:string){const r=await fetch(url,{headers:HEADERS,signal:AbortSignal.timeout(12000),next:{revalidate:3600}});if(!r.ok)throw new Error("Municipal source HTTP "+r.status);return r;}
async function html(url:string){const t=await(await response(url)).text();if(/cf-chl-|Just a moment|Enable JavaScript and cookies/i.test(t))throw new Error("Municipal source challenge");return t;}
async function pdf(url:string,cache:PdfCache){
 const bytes=new Uint8Array(await(await response(url)).arrayBuffer());if(bytes.length>15000000||new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("Invalid agenda PDF");
 const hash=createHash("sha256").update(bytes).digest("hex");if(cache[url]?.hash===hash)return cache[url].text;
 const text=(await extractText(bytes,{mergePages:true})).text;if(text.trim().length<30)throw new Error("Agenda needs OCR; retaining prior items");cache[url]={hash,text};return text;
}
export function recentMunicipalMeetings(meetings:AgendaMeeting[],now=new Date()){
 const cutoff=new Date(now.getTime()-120*86400000).toISOString().slice(0,10);
 return [...new Map(meetings.filter(m=>m.date>=cutoff).map(m=>[m.id,m])).values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,18);
}
async function kunaMeetings(previous:AgendaMeeting[]=[]){
 let unavailable=false;
 const entries=[{body:"City Council",agenda:36,packet:43,minutes:37},{body:"P&Z",agenda:38,packet:42,minutes:39}];
 const meetings=(await Promise.all(entries.map(async e=>{
  const url=(n:number)=>"https://www.kunacity.id.gov/Archive.aspx?AMID="+n;
  const results=await Promise.allSettled([html(url(e.agenda)),html(url(e.packet)),html(url(e.minutes))]);
  const read=(index:number,kind:"agenda"|"packet"|"minutes")=>{const result=results[index];if(result.status==="rejected"){unavailable=true;return [];}try{return parseKunaArchive(result.value,e.body,url(e[kind]),kind);}catch{unavailable=true;return [];}};
  const agendas=read(0,"agenda"),packets=read(1,"packet"),minutes=read(2,"minutes");
  return recentMunicipalMeetings(agendas.length?agendas:previous.filter(m=>m.body===e.body)).map(item=>({...item,packetUrl:packets.find(p=>p.date===item.date)?.packetUrl??previous.find(p=>p.id===item.id)?.packetUrl,minutesUrl:minutes.find(p=>p.date===item.date)?.minutesUrl??previous.find(p=>p.id===item.id)?.minutesUrl}));
 }))).flat();
 return {meetings,unavailable};
}

type SanityBlock={_key?:string;children?:{text:string;marks?:string[]}[];markDefs?:{_key:string;href?:string;fileUpload?:{asset:{_ref:string}}}[]};
function blockLinks(b:SanityBlock){return (b.markDefs??[]).flatMap(m=>{const ref=m.fileUpload?.asset._ref;if(ref&&/^file-[a-f0-9]+-pdf$/.test(ref))return ["https://cdn.sanity.io/files/4vjerzrk/production/"+ref.replace(/^file-/,"").replace(/-pdf$/,".pdf")];if(m.href?.startsWith("https://middleton.id.gov/"))return [m.href];return [];});}
function middletonTitle(text:string){
 const ord=text.match(/Ordinance\s+(\d+)/i)?.[1];
 if(/school capacity/i.test(text))return "School capacity standards";
 if(/Starter Home|Accessory Dwelling/i.test(text))return "Starter homes and accessory dwelling units";
 if(/Parks.*Recreation|Parks.*Rec District/i.test(text))return "Park district capacity standards";
 if(/zoning districts/i.test(text))return "Zoning districts and development standards";
 if(/Duff Lane|Rosemary/i.test(text))return "Rosemary Subdivision annexation and preliminary plat";
 return ord?"Development code amendment — Ordinance "+ord:"Land-use hearing notice";
}
async function middletonCases(cache:PdfCache){
 const url="https://4vjerzrk.api.sanity.io/v2021-10-21/data/query/production?query="+encodeURIComponent('*[_type == "page" && pageType == "publicHearingNotices"] | order(_createdAt asc)'),payload=JSON.parse(await html(url)) as {result:{sections:{title:string;text:SanityBlock[]}[]}[]};
 if(!payload.result?.[0]?.sections)throw new Error("Hearing notice content missing");
 const cases=new Map<string,MunicipalCase>();
 const ordinances=new Map(payload.result[0].sections.flatMap(section=>section.text.flatMap(b=>{const ord=clean(b.children?.map(c=>c.text).join("")).match(/Ordinance\s+(\d+)/i)?.[1];return ord&&b._key?[[b._key,ord] as [string,string]]:[];})));
 for(const section of payload.result[0].sections)for(const block of section.text){const text=clean(block.children?.map(c=>c.text).join(""));if(!/^Application\b/i.test(text))continue;
 const ord=text.match(/Ordinance\s+(\d+)/i)?.[1]??ordinances.get(block._key??""),id=ord?"ORD-"+ord:/Duff Lane|Rosemary/i.test(text)?"NOTICE-ROSEMARY":"NOTICE-"+block._key;
 const title=middletonTitle(text),citywide=Boolean(ord)||/amend.*(?:MCC|Middleton City Code)/i.test(text),urls=blockLinks(block);
 let h=cases.get(id);if(!h){h={appId:id,appType:citywide?"ORD":"PLAN",appTypeLabel:citywide?"Code amendment":"Annexation and preliminary plat",appStatus:"In review",appPhase:"Review",appPhaseRaw:"Review",appScope:null,appAcres:null,externalUrl:MUNICIPAL_SOURCES.middleton.tracker,energovPlanId:null,meetings:[],citywide,displayTitle:title,summary:citywide?text.replace(/^Application (?:of Middleton City )?to /i,"Proposal to "):"Proposed annexation, rezone and preliminary plat at Duff Lane and 9th Street.",municipal:{area:"middleton",name:title,address:citywide?"":"Duff Lane & 9th Street, Middleton, ID",sourceUrl:MUNICIPAL_SOURCES.middleton.tracker,relatedIds:[id],documents:[]}};cases.set(id,h);}
 for(const link of urls){const document:RecordDocument={label:/On-Site/i.test(section.title)?"Public hearing notice":"Application / proposed ordinance",filename:title,url:link,sourceUrl:MUNICIPAL_SOURCES.middleton.tracker};if(!h.municipal.documents.some(d=>d.url===link))h.municipal.documents.push(document);
 if(!/On-Site/i.test(section.title))continue;
 const source=await pdf(link,cache),match=source.match(/The Middleton\s+(Planning and Zoning Commission|City Council)\s+is scheduled to hold a public\s+hearing at ([\s\S]*?)\bat 1103 W\./i);if(!match)continue;
 const date=humanDate(clean(match[2]));if(!date)continue;const body=/Council/i.test(match[1])?"City Council":"P&Z";
 if(!h.meetings.some(m=>m.body===body&&m.date===date))h.meetings.push({body,bodyLabel:match[1],date,dateLabel:date,time:clock(match[2]),location:MUNICIPAL_SOURCES.middleton.location,sourceUrl:link,continuedNote:null});
 }
 }
 return [...cases.values()];
}
export async function refreshMunicipalFeed(area:MunicipalId):Promise<MunicipalFeed>{
 const s=MUNICIPAL_SOURCES[area],previous=await readSourceFeed(area).catch(()=>undefined) as MunicipalFeed|undefined,cache={...previous?.pdfCache},cases=new Map<string,MunicipalCase>();let dataUnavailable=false,scheduleUnavailable=false;
 const old=[...(previous?.active??[]),...(previous?.completed??[])] as MunicipalCase[];
 if(area==="middleton"){
  try{for(const h of await middletonCases(cache))cases.set(h.appId,h);}catch{dataUnavailable=true;scheduleUnavailable=true;console.error("["+area+"] Hearing notices unavailable; retaining cached records");for(const h of old)cases.set(h.appId,h);}
 }else if(s.cases){
  try{const year=new Date().getFullYear(),where=area==="kuna"?"Active_Application = 'Y' OR Case_No LIKE '%"+String(year).slice(2)+"-%' OR Case_No LIKE '%"+String(year-1).slice(2)+"-%'":"1=1",features=(await geoQuery(s.cases,{where,returnGeometry:"false"})).features;
   for(const f of features)for(const id of municipalCaseIds(area,clean(f.properties?.[s.caseField]))){const h=municipalFromFeature(area,f,id);if(!cases.has(id))cases.set(id,h);}
  }catch{dataUnavailable=true;console.error("["+area+"] Case tracker unavailable; retaining cached records");for(const h of old)cases.set(h.appId,h);}
 }
 let meetings:AgendaMeeting[]=[];
 if(area!=="middleton"){
  try{
   if(area==="kuna"){const result=await kunaMeetings(previous?.agendaMeetings);meetings=result.meetings;scheduleUnavailable=result.unavailable;}
   else if(area==="star"){
    const pages=await Promise.allSettled([1,2,3].map(page=>html(s.agendas.replace(/p=1$/,"p="+page)).then(t=>parseStarMeetings(t,s.agendas))));
    scheduleUnavailable=pages.some(p=>p.status==="rejected");
    meetings=recentMunicipalMeetings([...pages.flatMap(p=>p.status==="fulfilled"?p.value:[]),...(scheduleUnavailable?previous?.agendaMeetings??[]:[])]);
   }else meetings=recentMunicipalMeetings(parseEagleMeetings(await html(s.agendas),s.agendas));
   if(scheduleUnavailable)console.error("["+area+"] Part of meeting archive unavailable; other sources retained");
  }catch{scheduleUnavailable=true;console.error("["+area+"] Meeting archive unavailable; retaining cached meetings");meetings=previous?.agendaMeetings??[];}
  // Individual agenda failures never discard the case tracker or other meetings.
  for(let i=0;i<meetings.length;i+=5)await Promise.all(meetings.slice(i,i+5).map(async m=>{
   if(!m.agendaUrl)return;
   try{const text=await pdf(m.agendaUrl,cache);m.localStartTime=clock(text.slice(0,1000))??m.localStartTime;m.items=parseMunicipalAgenda(text,area,m.agendaUrl);}catch{scheduleUnavailable=true;console.error("["+area+"] Agenda unavailable",m.id);m.items=previous?.agendaMeetings?.find(p=>p.id===m.id)?.items??[];}
  }));
  addAgendaCases(area,cases,meetings);
 }
 if(!cases.size&&(dataUnavailable||scheduleUnavailable))throw new Error(s.name+" sources unavailable");
 const feed:MunicipalFeed={...composeMunicipalFeed([...cases.values()],meetings),pdfCache:cache,dataUnavailable,scheduleUnavailable,scheduleRefreshedAt:scheduleUnavailable?previous?.scheduleRefreshedAt:new Date().toISOString()};
 // Retain only documents still present in collected meetings/notices, bounding cache growth.
 const used=new Set([...meetings.flatMap(m=>m.agendaUrl?[m.agendaUrl]:[]),...[...cases.values()].flatMap(h=>h.municipal.documents.map(d=>d.url))]);feed.pdfCache=Object.fromEntries(Object.entries(cache).filter(([url])=>used.has(url)));
 await saveSourceFeed(area,feed).catch(()=>console.error("["+area+"] Source cache could not be saved"));return feed;
}
export const MUNICIPAL_FEEDS=Object.fromEntries(MUNICIPAL_IDS.map(id=>[id,unstable_cache(()=>refreshMunicipalFeed(id),[id+":municipal-feed:v3"],{revalidate:3600,tags:[id+":cases"]})])) as Record<MunicipalId,()=>Promise<HearingFeed>>;
export const MUNICIPAL_PUBLIC_FEEDS=Object.fromEntries(MUNICIPAL_IDS.map(id=>[id,unstable_cache(async()=>await readSourceFeed(id,{omitPdfCache:true})??await MUNICIPAL_FEEDS[id](),[id+":public-feed:v1"],{revalidate:86400,tags:["map-area:"+id]})])) as Record<MunicipalId,()=>Promise<HearingFeed>>;
export const MUNICIPAL_LOCALITIES:Record<string,Locality>=Object.fromEntries(MUNICIPAL_IDS.map(id=>[id,{slug:id,displayName:MUNICIPAL_SOURCES[id].name,fullName:MUNICIPAL_SOURCES[id].name+", Idaho",portalUrl:MUNICIPAL_SOURCES[id].tracker,dataAttribution:"Official city planning records and published hearings",tracked:[],getHearings:MUNICIPAL_PUBLIC_FEEDS[id]}]));
