import {load} from "cheerio";
import type {Feature} from "geojson";
import type {Hearing,HearingFeed,AgendaMeeting} from "@/lib/localities/types";
import type {PublicCaseRecord,RecordDocument} from "@/lib/localities/record-types";
import {MUNICIPAL_SOURCES,type MunicipalId} from "./municipal-config";
import {denverInstant} from "@/lib/case-details";
export type MunicipalCase=Hearing&{municipal:{area:MunicipalId;name:string;address:string;sourceUrl:string;relatedIds:string[];documents:RecordDocument[];parcelIds?:string[]}};
export const MUNICIPAL_TYPES:Record<string,string>={AN:"Annexation",A:"Annexation",AZ:"Annexation and zoning",ZC:"Rezone",RZ:"Rezone",RZDA:"Rezone and development agreement",S:"Subdivision",PP:"Preliminary plat",FP:"Final plat",PPFP:"Preliminary and final plat",PPUD:"Preliminary development plan",PUD:"Planned unit development",CUP:"Conditional use permit",CU:"Conditional use permit",SUP:"Special use permit",DR:"Design review",DA:"Development agreement",CPF:"Combined preliminary and final plat",CPA:"Comprehensive plan amendment",OA:"Code amendment",ORD:"Code amendment",PLAN:"Planning application"};
export const clean=(s:unknown)=>String(s??"").replace(/\s+/g," ").trim();
export function municipalCaseIds(area:MunicipalId,text:string):string[]{
 const re=area==="kuna"?/\b\d{2}-\d{2,3}-(?:AN|ZC|S|PP|FP|DR|DA|SUP|CUP|PUD|CPF|CPA|OA)\b/gi:area==="eagle"?/\b[A-Z]{1,5}-\d{4}-\d{1,3}(?:-MOD\d+)?\b/gi:/\b[A-Z]{1,5}-\d{2}-\d{2,5}\b/g;
 return [...new Set((text.replace(/-\s*\n\s*/g,"-").match(re)??[]).map(x=>x.toUpperCase()))];
}
function typeFor(id:string,area:MunicipalId){return area==="kuna"?id.split("-").at(-1)!:id.split("-")[0];}
export function municipalTitle(h:Hearing){return h.displayTitle||(h as MunicipalCase).municipal.name||h.appTypeLabel+" ("+h.appId+")";}
export function municipalSummary(h:Hearing){return h.summary||h.description||(h.appScope?h.appScope+": ":"")+h.appTypeLabel+" proposal.";}
export function municipalStage(h:Hearing,now=new Date()):import("@/lib/maps/types").MapStage{
 if(h.decisionRecorded)return "Decided";
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver"}).format(now);
 const next=h.meetings.filter(m=>m.date>=today&&!m.continuedNote).sort((a,b)=>a.date.localeCompare(b.date))[0];
 if(next)return /council|board/i.test(next.body)?"Council/Board":"P&Z";
 return /submitted/i.test(h.appStatus)?"Filed":"In review";
}
function sourceLink(html:unknown,area:MunicipalId){const href=load(String(html??""))("a").attr("href");if(!href)return;try{const u=new URL(href);if(u.protocol==="https:"&&(area==="kuna"&&u.hostname==="kunaid.sharepoint.com"))return u.href;}catch{}}
export function municipalFromFeature(area:MunicipalId,f:Pick<Feature,"properties">,caseId?:string):MunicipalCase{
 const s=MUNICIPAL_SOURCES[area],p=f.properties??{},relatedIds=municipalCaseIds(area,clean(p[s.caseField])),id=caseId??relatedIds[0]??"",type=typeFor(id,area),name=clean(p[s.nameField]),status=clean(p[s.statusField]);
 const sourceUrl=s.cases+"/query?"+new URLSearchParams({where:(area==="kuna"?"OBJECTID":"FID")+" = "+Number(p[area==="kuna"?"OBJECTID":"FID"]),outFields:"*",returnGeometry:"false",f:"pjson"});
 const files=sourceLink(p.MoreInfo,area),description=clean(p.Descript),address=clean(p.Address);
 const decided=area==="kuna"?/^(approved|denied|withdrawn)$/i.test(status):status==="Project Entitled";
 const h:MunicipalCase={appId:id,appType:type,appTypeLabel:MUNICIPAL_TYPES[type]??"Planning application",appStatus:status||"In review",appPhase:"Review",appPhaseRaw:"Review",appScope:name||null,description:description||undefined,appAcres:null,externalUrl:files??s.tracker,energovPlanId:null,meetings:[],decisionRecorded:decided,citywide:type==="OA",displayTitle:name||undefined,summary:description?name+": "+description.replace(/[.\s]+$/,"")+".":undefined,municipal:{area,name,address,sourceUrl,relatedIds,documents:files?[{label:"Official application materials",filename:name,url:files,sourceUrl:s.tracker}]:[]}};
 // Eagle provides a next-hearing date; its timezone metadata does not establish a reliable time.
 if(area==="eagle"&&typeof p.NextHear==="number"&&clean(p.HearBody)){
  const date=new Date(p.NextHear).toISOString().slice(0,10),body=/council/i.test(String(p.HearBody))?"City Council":/design/i.test(String(p.HearBody))?"Design Review Board":"P&Z";
  // The tracker stores wall-clock values without a reliable timezone reference. Dates are usable;
  // hearing times come from the published meeting calendar/agenda, never this ambiguous timestamp.
  h.meetings.push({body,bodyLabel:body==="P&Z"?"Planning & Zoning Commission":body,date,dateLabel:date,location:s.location,sourceUrl,continuedNote:null});
 }
 return h;
}
export function parseMunicipalAgenda(text:string,area:MunicipalId,agendaUrl:string):AgendaMeeting["items"]{
 const normalized=text.replace(/-\s*\n\s*/g,"-");
 const start=normalized.search(/^\s*\d+[.)]\s+PUBLIC HEARINGS\b/im);if(start<0)return [];
 const rest=normalized.slice(start),end=rest.slice(25).search(/^\s*\d+[.)]\s+(?:BUSINESS|UNFINISHED|NEW BUSINESS|ADJOURN|UPDATES)\b/im),section=end>=0?rest.slice(0,end+25):rest;
 const blocks=section.split(/^\s*[A-Z]\.\s+/m).slice(1);
 return blocks.flatMap(block=>{
  const title=clean(block.split(/Potential Motions?:/i)[0]),ids=municipalCaseIds(area,title);
  // Star also publishes numeric application references for preliminary/final plats.
  if(area==="star"&&!ids.length&&/preliminary|final plat/i.test(title)){const n=title.match(/\((\d{5})\)/);if(n)ids.push(n[1]);}
  return ids.length?[{title,caseIds:ids,agendaUrl,staffReports:[]}]:[];
 });
}
export function parseKunaArchive(html:string,body:string,sourceUrl:string,kind:"agenda"|"packet"|"minutes"="agenda"):AgendaMeeting[]{
 const $=load(html);if(!$("a[href*='ADID=']").length)throw new Error("Archive links missing");
 return $("a[href*='ADID=']").toArray().flatMap(el=>{const a=$(el),title=clean(a.text()),m=title.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);if(!m||/cancel/i.test(title))return [];const date=`${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`,id=new URL(a.attr("href")!,sourceUrl).searchParams.get("ADID"),url="https://www.kunacity.id.gov/Archive/ViewFile/Item/"+id;return [{id:body+date,body,bodyLabel:body==="P&Z"?"Planning & Zoning Commission":body,title,date,dateLabel:date,sourceUrl,...(kind==="agenda"?{agendaUrl:url}:kind==="packet"?{packetUrl:url}:{minutesUrl:url}),items:[]}];});
}
export function parseStarMeetings(html:string,sourceUrl:string):AgendaMeeting[]{
 const $=load(html);if(!$("table.mcm").length)throw new Error("Meeting table missing");
 const canceled=new Set($("table.mcm tr").toArray().filter(el=>/City Council.*CANCEL/i.test(clean($(el).find("td.meeting").text()))).map(el=>clean($(el).find("td.date").text())));
 return $("table.mcm tr").toArray().flatMap(el=>{const r=$(el),title=clean(r.find("td.meeting").text()),m=clean(r.find("td.date").text()).match(/^(\d+)\/(\d+)\/(\d{4})$/);if(!m||!/City Council/i.test(title)||/cancel/i.test(title)||canceled.has(clean(r.find("td.date").text())))return [];const date=`${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`,link=(cls:string)=>{const href=r.find("td."+cls+" a").attr("href");return href?new URL(href,sourceUrl).href:undefined;};return [{id:"City Council"+date,body:"City Council",bodyLabel:"City Council",title,date,dateLabel:date,location:MUNICIPAL_SOURCES.star.location,sourceUrl,agendaUrl:link("agenda"),packetUrl:link("packet"),minutesUrl:link("minutes"),videoUrl:link("multimedia"),items:[]}];});
}
export function parseEagleMeetings(html:string,sourceUrl:string):AgendaMeeting[]{
 const $=load(html);if(!$("a[href*='AgendaViewer']").length)throw new Error("Meeting archive missing");
 return $("tr").toArray().flatMap(el=>{const row=$(el);if(row.find("tr").length)return [];const text=clean(row.children("td").toArray().map(td=>$(td).text()).join(" ")),dateMatch=text.match(/\b([A-Z][a-z]+ \d{1,2}, 20\d{2})(?:\s*-\s*(\d{1,2}:\d{2}\s*[AP]M))?/),body=/^City Council\b/i.test(text)?"City Council":/^Planning and Zoning Commission\b/i.test(text)?"P&Z":undefined;if(!dateMatch||!body||/cancel/i.test(text))return [];const date=humanDate(dateMatch[1]);if(!date)return [];const link=(pattern:RegExp)=>{const href=row.find("a[href]").toArray().map(a=>$(a).attr("href")!).find(h=>pattern.test(h));return href?new URL(href,sourceUrl).href:undefined;};return [{id:body+date,body,bodyLabel:body==="P&Z"?"Planning & Zoning Commission":body,title:body,date,dateLabel:date,localStartTime:dateMatch[2]?clock(dateMatch[2]):undefined,location:MUNICIPAL_SOURCES.eagle.location,sourceUrl,agendaUrl:link(/AgendaViewer/),minutesUrl:link(/MinutesViewer/),videoUrl:link(/MediaPlayer/),items:[]}];});
}
export function humanDate(s:string):string|undefined{const m=s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})/i);if(!m)return;const month=["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(m[1].toLowerCase())+1;return `${m[3]}-${String(month).padStart(2,"0")}-${m[2].padStart(2,"0")}`;}
export function clock(text:string){const m=text.match(/(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i);return m?String(+m[1]%12+(m[3].toLowerCase()==="p"?12:0)).padStart(2,"0")+":"+m[2]:undefined;}
function agendaProjectName(item:AgendaMeeting["items"][number],area:MunicipalId){
 const raw=item.title.replace(/^(?:Case No\.?\s*)/i,"").split(/ – | — /)[0];
 const heading=area==="star"?raw.split(/\([A-Z]{1,5}-\d|\(\d{5}\)/)[0].split(" The Applicant")[0]:raw;
 return area==="kuna"?heading.replace(/\b\d{2}-\d{2,3}-[A-Z]+\b/g,"").replace(/^[,&\s]+/,"").trim():heading.length<120?heading.replace(/[ (]+$/,""):"";
}
export function addAgendaCases(area:MunicipalId,cases:Map<string,MunicipalCase>,meetings:AgendaMeeting[]){
 for(const m of meetings)for(const item of m.items){
  const source=MUNICIPAL_SOURCES[area];
  // Only a GIS tracker can supply a name for another linked agenda reference. Agenda-only
  // identifiers may be duplicated or mistyped by the city across unrelated projects.
  const native=item.caseIds.map(id=>cases.get(id)).find(h=>source.cases&&h?.municipal.sourceUrl.startsWith(source.cases+"/query?"));
  const proposedName=native?.municipal.name||agendaProjectName(item,area),normalized=(v:string)=>v.replace(/[’]/g,"'").replace(/\s+/g," ").trim().toLowerCase();
  const safeIds=item.caseIds.filter(id=>{const existing=cases.get(id);if(!existing||native||!proposedName)return true;
   if(normalized(existing.municipal.name)===normalized(proposedName))return true;
   console.error("["+area+"] Conflicting agenda project reference; association withheld",id);return false;
  });
  for(const id of safeIds){let h=cases.get(id);
   if(!h){const parsedType=typeFor(id,area),type=/^\d{5}$/.test(id)&&/preliminary\/final plat/i.test(item.title)?"PPFP":MUNICIPAL_TYPES[parsedType]?parsedType:"PLAN",name=proposedName||MUNICIPAL_TYPES[type]||"Planning application";
    h={appId:id,appType:type,appTypeLabel:MUNICIPAL_TYPES[type]??"Planning application",appStatus:"In review",appPhase:"Review",appPhaseRaw:"Review",appScope:null,appAcres:null,externalUrl:item.agendaUrl,energovPlanId:null,meetings:[],citywide:type==="OA",municipal:{area,name,address:"",sourceUrl:item.agendaUrl,relatedIds:safeIds,documents:[]}};cases.set(id,h);
   }
   h.municipal.relatedIds=[...new Set([...h.municipal.relatedIds,...safeIds])];
   h.municipal.parcelIds=[...new Set([...(h.municipal.parcelIds??[]),...(item.title.match(/\b[RS]\d{9,12}\b/g)??[])])];
   if(!h.summary)h.summary=native?.summary??clean(item.title).split(/Potential Motions?:/i)[0].replace(/^.*?\)\s+(?=The (?:Applicant|City))/i,"").replace(/\b(?:and also include )?(?:parcels?|parcel (?:no|number)\.?)\s+(?:[A-Z]?\d+[\s,&]*)+/gi,"").replace(/\(ACTION ITEM\)/gi,"").replace(/\s+/g," ").trim();
   const date=m.date,existing=h.meetings.find(e=>e.body===m.body&&e.date===date),hearing={body:m.body,bodyLabel:m.bodyLabel,date,dateLabel:m.dateLabel,time:m.localStartTime,location:m.location??source.location,sourceUrl:item.agendaUrl,agendaUrl:m.agendaUrl,packetUrl:m.packetUrl,minutesUrl:m.minutesUrl,videoUrl:m.videoUrl,continuedNote:null};
   if(existing)Object.assign(existing,hearing);else h.meetings.push(hearing);
  }
 }
}

export function composeMunicipalFeed(cases:MunicipalCase[],meetings:AgendaMeeting[],now=new Date()):HearingFeed{
 for(const h of cases){for(const hearing of h.meetings){const meeting=meetings.find(m=>m.body===hearing.body&&m.date===hearing.date);if(meeting){hearing.time=meeting.localStartTime??hearing.time;hearing.agendaUrl=meeting.agendaUrl??hearing.agendaUrl;hearing.minutesUrl=meeting.minutesUrl??hearing.minutesUrl;}}
 const stage=municipalStage(h,now);h.appPhaseRaw=stage;h.appPhase=stage==="P&Z"?"PZ Commission":stage==="Council/Board"?"City Council":"Review";h.displayTitle=municipalTitle(h);h.summary=municipalSummary(h);h.meetings.sort((a,b)=>a.date.localeCompare(b.date));}
 return {active:cases.filter(c=>!c.decisionRecorded),completed:cases.filter(c=>c.decisionRecorded),agendaMeetings:meetings,refreshedAt:now.toISOString()};
}
export function municipalRecord(h:Hearing):PublicCaseRecord{
 const c=h as MunicipalCase,m=c.municipal;
 return {sourceUrl:m.sourceUrl,address:m.address,sourceStatus:h.appStatus,approvalStatus:h.decisionRecorded?h.appStatus:"",documents:m.documents,events:h.meetings.map((e,i)=>({id:h.appId+e.body+e.date+i,caseIds:m.relatedIds.length?m.relatedIds:[h.appId],name:municipalTitle(h),address:m.address,body:e.body,date:e.date,time:e.time,startsAt:e.time?denverInstant(e.date,e.time,"America/Denver"):e.date,sourceUrl:e.sourceUrl,linkedIds:m.relatedIds.filter(id=>id!==h.appId),documents:[...(e.agendaUrl?[{label:"Agenda",filename:e.date,url:e.agendaUrl,sourceUrl:e.sourceUrl}]:[]),...(e.packetUrl?[{label:"Meeting packet",filename:e.date,url:e.packetUrl,sourceUrl:e.sourceUrl}]:[]),...(e.minutesUrl?[{label:"Minutes — motions & votes",filename:e.date,url:e.minutesUrl,sourceUrl:e.sourceUrl}]:[])]}))};
}
