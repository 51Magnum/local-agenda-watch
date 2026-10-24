import {load} from "cheerio";
import type {Feature} from "geojson";
import type {Hearing,HearingFeed,AgendaMeeting} from "@/lib/localities/types";
export const MERIDIAN_NOTICES="https://apps.meridiancity.org/CLERKSCONTENT/pubhearnot_detail.aspx";
export const MERIDIAN_CASES="https://gis.meridiancity.org/server/rest/services/CD/Development_Feature_Layer/FeatureServer/6";
export const MERIDIAN_WHERE="Active = 'Y' OR App_Year >= "+(new Date().getFullYear()-1);
export const MERIDIAN_PORTALS={"P&Z":"https://meetings.municode.com/PublishPage/index?cid=MERIDIANID&p=1&ppid=15b4c25d-0dbe-460d-a370-3c178682c24e","City Council":"https://meetings.municode.com/PublishPage/index?cid=MERIDIANID&p=1&ppid=add14759-167d-4b0f-bec9-c9affe54bcaf"};
export const MERIDIAN_TYPES:Record<string,string>={SPP:"Preliminary plat",SPF:"Final plat",CUP:"Conditional use permit",ANN:"Annexation",ZMA:"Rezone",CMA:"Comprehensive plan amendment",ZTA:"Zoning text amendment",CTA:"Comprehensive plan text amendment",PLAN:"Planning application"};
export const MERIDIAN_ID=/\b(?:H|SHP|ZOA|CPAM|PUD|FP|PP|AZ|CUP)-\d{4}-\d{4}\b/g;
export type MeridianNotice={caseIds:string[];date:string;body:string;title:string;description:string;filesUrl?:string;citywide:boolean;sourceUrl:string};
export type MeridianCase=Hearing&{meridian:{name:string;attributes:Record<string,unknown>;action:string;actionDate?:string;authority:string;active:boolean;workflowDate?:string;workflowStatus:string;lots?:number;notices:MeridianNotice[]}};
const clean=(s:string)=>s.replace(/\s+/g," ").trim();
function dateOnly(s:string){const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?`${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`:undefined;}
function safeLink(value:string|undefined){if(!value)return;try{const u=new URL(value);return u.protocol==="https:"&&["apps.meridiancity.org","weblink.meridiancity.org","meetings.municode.com","www.youtube.com","bit.ly"].includes(u.hostname)?u.href:undefined;}catch{return;}}
export function parseMeridianNotices(html:string):MeridianNotice[]{
 const $=load(html),table=$("table").filter((_,el)=>/Meeting Type[\s\S]*Hearing Date[\s\S]*Project Description/.test($(el).text())).first();
 if(!table.length)throw new Error("Meridian hearing-notice markup missing");
 return table.find("tr").toArray().flatMap(row=>{const cells=$(row).children("td");if(cells.length<3)return [];const date=dateOnly(clean(cells.eq(1).text())),description=clean(cells.eq(2).text()),body=/council/i.test(cells.eq(0).text())?"City Council":"P&Z";if(!date)throw new Error("Invalid Meridian notice date");const firstId=description.match(MERIDIAN_ID)?.[0];const title=firstId?description.slice(0,description.indexOf(firstId)).replace(/[:\s]+$/,""):clean(cells.eq(3).find("a").text()).replace(/^Application Materials for /i,"");return [{caseIds:firstId?[firstId]:[],date,body,title,description,filesUrl:safeLink(cells.eq(3).find("a[href]").attr("href")),citywide:/located Citywide\b/i.test(description),sourceUrl:MERIDIAN_NOTICES}];});
}
export function parseMeridianMeetings(html:string,body:string,sourceUrl:string):AgendaMeeting[]{
 const $=load(html);if(!$("table.mcm").length)throw new Error("Meridian meeting index markup missing");
 return $("table.mcm tr").toArray().flatMap(row=>{const r=$(row),date=dateOnly(clean(r.find("td.date").text())),title=clean(r.find("td.meeting").text());if(!date||/work session|cancell/i.test(title))return [];const link=(cls:string)=>safeLink(r.find("td."+cls+" a[href]").attr("href"));const agendaUrl=link("adahtmlagenda")??link("agenda"),timeText=clean(r.find("td.time").text()),t=timeText.match(/^(\d+):(\d{2}) (AM|PM)$/);const localStartTime=t?String((+t[1]%12)+(t[3]==="PM"?12:0)).padStart(2,"0")+":"+t[2]:undefined;const id=agendaUrl?new URL(agendaUrl).searchParams.get("me")??body+date:body+date;return [{id,body,bodyLabel:body==="P&Z"?"Planning & Zoning Commission":body,title,date,dateLabel:date,timeLabel:timeText,localStartTime,location:"City Council Chambers, 33 East Broadway Avenue, Meridian, Idaho",sourceUrl,agendaUrl,htmlAgendaUrl:link("adahtmlagenda"),packetUrl:link("packet"),minutesUrl:link("minutes"),videoUrl:link("multimedia"),items:[]}];});
}
export function parseMeridianAgenda(html:string,agendaUrl:string):AgendaMeeting["items"]{
 const $=load(html);if(!$(".Section0").length)throw new Error("Meridian agenda markup missing");
 return $("li").toArray().flatMap(el=>{const block=$(el);if(block.find("li").length)return [];const heading=clean(block.find("p").first().text()),caseIds=[...new Set(heading.match(MERIDIAN_ID)??[])];if(!caseIds.length)return [];return [{title:clean(block.text()),caseIds,agendaUrl,staffReports:[]}];});
}
export async function meridianHtml(url:string){const r=await fetch(url,{headers:{Accept:"text/html","User-Agent":"Mozilla/5.0 LocalAgendaWatch/1.0"},signal:AbortSignal.timeout(10000),next:{revalidate:3600,tags:["meridian:sources"]}});if(!r.ok)throw new Error("Meridian source HTTP "+r.status);const html=await r.text();if(/cf-chl-|Just a moment|Enable JavaScript and cookies to continue/i.test(html))throw new Error("Meridian challenge page");return html;}
export function meridianFromFeature(f:Pick<Feature,"properties">):MeridianCase{
 const p=f.properties??{},id=clean(String(p.App_ID??"")).toUpperCase(),name=clean(String(p.Name??"")).replace(/\s+-\s+[A-Z, /]+$/,"");
 const type=p.PP==="Y"?"SPP":p.FP==="Y"?"SPF":p.CUP==="Y"?"CUP":p.AZ==="Y"?"ANN":"PLAN";
 const action=String(p.Action??"Pending"),authority=/council/i.test(String(p.Hearing_Type))?"City Council":/planning|zoning/i.test(String(p.Hearing_Type))?"P&Z":"Unknown";
 const workflowDate=typeof p.workflow_status_date==="string"?p.workflow_status_date.slice(0,10):undefined;
 return {appId:id,appType:type,appTypeLabel:MERIDIAN_TYPES[type],appStatus:action,appPhase:"Review",appPhaseRaw:"Review",appScope:name||null,appAcres:null,externalUrl:safeLink(p.Weblink)??null,energovPlanId:null,meetings:[],meridian:{name,action,authority,attributes:p,actionDate:typeof p.Appr_Date==="number"?new Date(p.Appr_Date).toISOString().slice(0,10):undefined,active:p.Active==="Y",workflowDate,workflowStatus:String(p.workflow_status??""),lots:typeof p.Lots_Buildable==="number"&&p.Lots_Buildable>0?p.Lots_Buildable:undefined,notices:[]}} as MeridianCase;
}
export function meridianTitle(h:Hearing){return (h as MeridianCase).meridian.name||h.appTypeLabel+" ("+h.appId+")";}
export function meridianSummary(h:Hearing){const m=(h as MeridianCase).meridian;const notice=m.notices.at(-1);if(!notice)return h.appTypeLabel+" proposal: "+(m.name||h.appId)+".";const index=notice.description.indexOf(h.appId);const description=notice.description.slice(index>=0?index+h.appId.length:0).replace(/^[:\s]+/,"").split(/\bApplicant:/)[0].split(/\b(?:in the (?:east|west|north|south)|section \d|T\.\d|Inst\.)/i)[0];return description.length>380?description.slice(0,description.lastIndexOf(",",380)||380)+".":description.replace(/[.\s]+$/,"")+".";}
export function meridianStage(h:Hearing,now=new Date()):string{
 const m=(h as MeridianCase).meridian,today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver"}).format(now);
 const next=h.meetings.filter(e=>e.date>=today&&!e.continuedNote).sort((a,b)=>a.date.localeCompare(b.date))[0];if(next)return next.body==="City Council"?"Council/Board":"P&Z";
 // Active=Y and Appr_Date are not outcomes. P&Z approval can be a recommendation.
 if((/^(approved|denied)$/i.test(m.action)&&m.authority==="City Council")||/^(expired|withdrawn)$/i.test(m.action))return "Decided";
 if(/approved/i.test(m.action)&&m.authority==="P&Z")return "In review";
 return /scheduled/i.test(m.action)?m.authority==="City Council"?"Council/Board":"P&Z":"In review";
}
export function composeMeridianFeed(features:Pick<Feature,"properties">[],notices:MeridianNotice[],meetings:AgendaMeeting[],now=new Date()):HearingFeed{
 const cases=new Map<string,MeridianCase>();for(const f of features){const h=meridianFromFeature(f);if(h.appId&&!cases.has(h.appId))cases.set(h.appId,h);}
 const folder=(url:string|undefined|null)=>{try{const u=new URL(url!);return u.hostname.toLowerCase()+":"+u.searchParams.get("id");}catch{return "";}};
 for(const n of notices)for(const id of n.caseIds.length?n.caseIds:[...cases.values()].filter(h=>n.filesUrl&&h.externalUrl&&folder(n.filesUrl)===folder(h.externalUrl)).map(h=>h.appId)){let h=cases.get(id);if(!h){h=meridianFromFeature({properties:{App_ID:id,Name:n.title,Weblink:n.filesUrl}});cases.set(id,h);}h.meridian.notices.push({...n,caseIds:[id]});h.citywide=n.citywide;h.description=n.description;}
 for(const meeting of meetings)for(const item of meeting.items.filter(item=>/^(?:\d+[.)]\s*)?Public Hearing\b/i.test(item.title)))for(const id of item.caseIds){if(!cases.has(id)){
 const heading=item.title.replace(/^(?:\d+[.)]\s*)?Public Hearing\s*:?\s*/i,"").split(id)[0].replace(/[(:\s]+$/,"").trim();
 cases.set(id,meridianFromFeature({properties:{App_ID:id,Name:heading}}));
 }const h=cases.get(id)!;h.meetings.push({body:meeting.body,bodyLabel:meeting.bodyLabel,date:meeting.date,dateLabel:meeting.dateLabel,time:meeting.localStartTime,location:meeting.location,sourceUrl:item.agendaUrl,agendaUrl:meeting.agendaUrl,packetUrl:meeting.packetUrl,minutesUrl:meeting.minutesUrl,videoUrl:meeting.videoUrl,continuedNote:null});}
 for(const h of cases.values()){
  for(const n of h.meridian.notices){const existing=h.meetings.find(e=>e.body===n.body&&e.date===n.date);if(!existing)h.meetings.push({body:n.body,bodyLabel:n.body==="P&Z"?"Planning & Zoning Commission":n.body,date:n.date,dateLabel:n.date,sourceUrl:n.sourceUrl,continuedNote:null});}
  h.meetings.sort((a,b)=>a.date.localeCompare(b.date));const stage=meridianStage(h,now);h.decisionRecorded=stage==="Decided";h.appPhaseRaw=stage==="Council/Board"?"City Council":stage==="P&Z"?"PZ Commission":stage==="Decided"?"Decided":"Review";h.appPhase=h.appPhaseRaw==="City Council"?"City Council":h.appPhaseRaw==="PZ Commission"?"PZ Commission":"Review";h.displayTitle=meridianTitle(h);h.summary=meridianSummary(h);
 }
 return {active:[...cases.values()].filter(h=>!h.decisionRecorded),completed:[...cases.values()].filter(h=>h.decisionRecorded),agendaMeetings:meetings,refreshedAt:now.toISOString()};
}

/** Internal GIS provenance only; agenda-only cases have no database record. */
export function meridianRecordUrl(h:Hearing){if(!("OBJECTID" in (h as MeridianCase).meridian.attributes))return "";return MERIDIAN_CASES+"/query?"+new URLSearchParams({where:"App_ID = '"+h.appId.replace(/'/g,"''")+"'",outFields:"App_ID,Name,Active,Action,Hearing_Type,Appr_Date,workflow_status,workflow_status_date,PP,FP,CUP,AZ",returnGeometry:"false",f:"pjson"});}
