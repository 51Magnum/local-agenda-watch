import { load } from "cheerio";
import type { Feature, FeatureCollection } from "geojson";
import type { Hearing, HearingFeed, Locality } from "@/lib/localities/types";
import { denverInstant } from "@/lib/case-details";

export const COUNTY_PORTAL = "https://landhearingsagenda.canyoncounty.id.gov";
export const COUNTY_CASE_LAYER = "https://maps.canyonco.org/arcgisserver/rest/services/DSD/DSD_PLANNING_ZONING_APP_TRACKER/FeatureServer/0";
export const COUNTY_FLUM_LAYER = "https://maps.canyonco.org/arcgisserver/rest/services/DSD/Future_Land_Use_2030_Adopted/MapServer/1";
export const COUNTY_CITY_LIMITS = "https://maps.canyonco.org/arcgisserver/rest/services/General/CITY_LIMITS_PUBLIC/FeatureServer/0";
export const COUNTY_TYPES: Record<string, string> = { SD: "Subdivision", SPP:"Preliminary plat", SPF:"Final plat", SPS:"Short plat", CMA:"Comprehensive plan map amendment", CTA:"Comprehensive plan text amendment", CR: "Conditional rezone", CU: "Conditional use permit", RZ: "Rezone", ZV: "Variance", OR: "Ordinance amendment", AD: "Administrative request", ADR: "Administrative request", RD: "Land division", PH: "Planning request" };
export const COUNTY_CASE_RE = /\b[A-Z]{2,4}\d{4}-\d{2,5}(?:-(?:APL|MOD))?\b/g;
export type CountyDocument = { label: string; filename: string; url: string; sourceUrl: string };
export type CountyEvent = { id: string; caseIds: string[]; name: string; address: string; body: string; date: string; time?: string; startsAt: string; deadline?: string; result?: string; note?: string; sourceUrl: string; documents: CountyDocument[]; linkedIds: string[]; countywide?: boolean };
export type CountyCase = Hearing & { county: { appliedDate?: string; decisionDate?: string; address: string; events: CountyEvent[]; sourceStatus: string; approvalStatus: string } };
export function countyCaseWhere(now = new Date()) { return "Status = 'Active' OR AppSubmitted >= date '" + (now.getUTCFullYear()-1) + "-01-01' OR DecisionDate >= date '" + (now.getUTCFullYear()-1) + "-01-01'"; }
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
function isoDate(text: string) { const m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/); if (!m) return; const date = `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`; return new Date(date+"T12:00:00Z").toISOString().slice(0,10) === date ? date : undefined; }
function timestampDate(value: unknown) { if (typeof value !== "number" || !Number.isFinite(value)) return; return new Date(value).toISOString().slice(0,10); }
export function parseCountyMonth(html: string): string[] {
  const $ = load(html);
  if (!$("#event-accordion").length) throw new Error("County calendar markup missing");
  return [...new Set($(".event-detail-trigger[data-id]").map((_,el)=>$(el).attr("data-id")!).get().filter(id=>/^\d+$/.test(id)))];
}
export function parseCountyEvent(html: string, id: string): CountyEvent {
  const $ = load(html);
  if (!$(".card-body").length) throw new Error("County hearing detail markup missing");
  const block = (label: string) => $("span").filter((_,el)=>clean($(el).text())===label).first().parent();
  const dateText = clean(block("Hearing Date/Time").find("p").text());
  const date = isoDate(dateText); if (!date) throw new Error("County hearing date missing");
  const timeMatch = dateText.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
  const time = timeMatch ? String((+timeMatch[1] % 12)+(timeMatch[3].toUpperCase()==="PM"?12:0)).padStart(2,"0")+":"+timeMatch[2] : undefined;
  const applicant = block("Applicant/Owner").length ? block("Applicant/Owner") : block("Ordinance Details");
  const caseIds = [...new Set(applicant.text().toUpperCase().match(COUNTY_CASE_RE)??[])];
  const name = clean(applicant.find("p").clone().find("small").remove().end().text());
  const header = clean($(".card").first().children("div").first().text());
  const authority = header+" "+clean(block("Hearing Date/Time").find("small").text());
  const body = /BOCC|Commissioners/i.test(authority) ? "Board of County Commissioners" : /Examiner/i.test(authority) ? "Hearing Examiner" : /P&Z|Planning.*Zoning/i.test(authority) ? "P&Z" : "Ordinance hearing";
  const sourceUrl = COUNTY_PORTAL+"/Landing?eventId="+id;
  const resultText = clean(block("Final Action").find(".badge").text());
  const result = resultText && !/^pending$/i.test(resultText) ? resultText : undefined;
  const documents = $("a[href^='/DownloadDocument/']").map((_,el)=>({ label: clean($(el).text()), filename: $(el).attr("data-bs-title")??clean($(el).text()), url: COUNTY_PORTAL+$(el).attr("href"), sourceUrl })).get().filter(d=>!/(?:sign[ _-]*in|attendance[ _-]*(?:sheet|list|roster)|sign[ _-]*up[ _-]*sheet)/i.test(d.label+" "+d.filename));
  return { id, caseIds, name, body, countywide:/Ordinance Updates/i.test(header), date, time, startsAt: time?denverInstant(date,time,"America/Denver"):date, deadline: isoDate(block("Comment Deadline").text()), address: clean(block("Property Details").find("p").first().text()), result, note: clean(block("Hearing Date/Time").find("small").text())||undefined, sourceUrl, documents, linkedIds: [...new Set($("a[data-event-id]").map((_,el)=>$(el).attr("data-event-id")!).get().filter(v=>/^\d+$/.test(v)))] };
}
export function countyFromFeature(feature: Pick<Feature,"properties">): CountyCase {
  const p = feature.properties??{}, id = String(p.PermitNum??"").trim().toUpperCase();
  const prefix = id.match(/^[A-Z]+/)?.[0]??"", label = clean(String(p.AppType??p.AppType2??COUNTY_TYPES[prefix]??"Planning request")).replace(/^PLAT - (.+)$/i,"$1 plat");
  const type=/comprehensive.*text/i.test(label)?"CTA":/comprehensive.*map/i.test(label)?"CMA":/prelim.*plat/i.test(label)?"SPP":/final.*plat/i.test(label)?"SPF":/short.*plat/i.test(label)?"SPS":prefix;
  return { appId:id, appType:type, appTypeLabel:label, appStatus:String(p.ApprovalStatus??p.Status??"In review"), appPhase:"Review", appPhaseRaw:"Review", appScope:clean(String(p.Description??""))||null, description:clean(String(p.Description??"")), appAcres:null, externalUrl:p.OBJECTID==null?null:COUNTY_CASE_LAYER+"/query?"+new URLSearchParams({where:"PermitNum = '"+id.replace(/'/g,"''")+"'",outFields:"PermitNum,AppSubmitted,AppType,AppType2,Description,ParcelAddress,Status,ApprovalStatus,DecisionDate",returnGeometry:"false",f:"pjson"}), energovPlanId:null, meetings:[], county:{appliedDate:timestampDate(p.AppSubmitted), decisionDate:timestampDate(p.DecisionDate), address:clean(String(p.ParcelAddress??"")),events:[],sourceStatus:String(p.Status??""),approvalStatus:String(p.ApprovalStatus??"")} };
}
/** County event authority is retained; a recommendation is never a final approval. */
export function countyStage(h: Hearing, now = new Date()): string {
  if(h.decisionRecorded)return "Decided";
  const c = h as CountyCase, today = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver"}).format(now);
  const next = c.county.events.find(e=>e.date>=today && !/cancelled|canceled|continued|tabled/i.test(e.result??""));
  if (next) return next.body==="Board of County Commissioners"?"Council/Board":next.body==="Hearing Examiner"?"Hearing Examiner":"P&Z";
  const latest = [...c.county.events].reverse().find(e=>e.result);
  if (latest && /^(approved|denied)\b/i.test(latest.result!)) return "Decided";
  if (latest && /recommend/i.test(latest.result!)) return "In review";
  if (/^(approved|denied|withdrawn|void|expired)$/i.test(c.county.approvalStatus)||/^(closed|withdrawn|void|expired)$/i.test(c.county.sourceStatus)) return "Decided";
  const last = c.county.events.at(-1);
  return last?.body==="Board of County Commissioners"?"Council/Board":last?.body==="Hearing Examiner"?"Hearing Examiner":last?.body==="P&Z"?"P&Z":"In review";
}
export function countyTitle(h: Hearing): string {
  const c = h as CountyCase;
  const name = c.county?.events.map(e=>e.name).find(n=>/subdivision|heights|landing|ridge|church|ordinance amendment|\bLLC\b|industrial|commercial/i.test(n));
  const type = h.appTypeLabel.toLowerCase();
  return name ? name+(h.citywide||name.toLowerCase().includes(type)?"":" · "+type) : h.appTypeLabel+(c.county?.address?" at "+c.county.address:" ("+h.appId+")");
}
export function countySummary(h: Hearing): string {
  const text = h.description?.trim();
  return text && text.length<=320 && !/\b(?:section|township|range|owner)\b|\bR\d{7,}\b/i.test(text) ? text.replace(/\.$/,"")+"." : h.appTypeLabel+( (h as CountyCase).county?.address ? " at "+(h as CountyCase).county.address : "")+".";
}
export function composeCountyFeed(features: Pick<Feature,"properties">[], events: CountyEvent[], now = new Date()): HearingFeed {
  const cases = new Map<string,CountyCase>();
  for (const f of features) { const h=countyFromFeature(f); if (h.appId && !cases.has(h.appId)) cases.set(h.appId,h); }
  for (const event of events) for (const id of event.caseIds) {
    let h=cases.get(id);
    if (!h) { h=countyFromFeature({properties:{PermitNum:id,ParcelAddress:event.address}}); cases.set(id,h); }
    h.county.events.push(event);
  }
  for (const h of cases.values()) {
    h.citywide=h.county.events.some(e=>e.countywide);
    h.county.events.sort((a,b)=>a.date.localeCompare(b.date)||Number(a.id)-Number(b.id));
    const noticeAddress=[...h.county.events].reverse().find(e=>e.address&&!/^0(?:\s|,|$)/.test(e.address))?.address;
    if(noticeAddress)h.county.address=noticeAddress;
    h.meetings=h.county.events.map(e=>({body:e.body,bodyLabel:e.body==="P&Z"?"Planning & Zoning Commission":e.body,date:e.date,dateLabel:new Intl.DateTimeFormat("en-US",{dateStyle:"long",timeZone:"UTC"}).format(new Date(e.date+"T12:00:00Z")),time:e.time,commentDeadline:e.deadline,result:e.result,continuedNote:/^(?:continued|tabled|cancelled|canceled)/i.test(e.result??"")?e.result!:null,sourceUrl:e.sourceUrl,agendaUrl:e.documents.find(d=>/^agenda$/i.test(d.label))?.url,staffReports:e.documents.filter(d=>/staff report/i.test(d.label)).map(d=>({label:d.label,url:d.url}))}));
    const stage=countyStage(h,now); h.decisionRecorded=stage==="Decided";
    h.appPhaseRaw=stage==="Council/Board"?"Board":stage==="Hearing Examiner"?"Hearing Examiner":stage==="P&Z"?"PZ Commission":stage==="Decided"?"Decided":"Review";
    h.appPhase=stage==="Council/Board"?"City Council":stage==="P&Z"||stage==="Hearing Examiner"?"PZ Commission":"Review";
    if (h.decisionRecorded) h.appStatus=[...h.county.events].reverse().find(e=>/^(approved|denied)\b/i.test(e.result??""))?.result??(!/^(in progress|pending)?$/i.test(h.county.approvalStatus)?h.county.approvalStatus:h.county.sourceStatus);
  }
  for (const h of cases.values()) {h.displayTitle=countyTitle(h);h.summary=countySummary(h);}
  return {active:[...cases.values()].filter(h=>!h.decisionRecorded),completed:[...cases.values()].filter(h=>h.decisionRecorded),refreshedAt:now.toISOString()};
}
async function sourceText(path:string) {
  const response=await fetch(COUNTY_PORTAL+path,{headers:{Accept:"text/html","User-Agent":"Mozilla/5.0 (compatible; LocalAgendaWatch public records reader)"},signal:AbortSignal.timeout(10000),next:{revalidate:3600,tags:["canyon-county:hearings"]}});
  if (!response.ok) throw new Error("County hearings HTTP "+response.status);
  const html=await response.text(); if (/Just a moment|cf-chl-|Attention Required/i.test(html)) throw new Error("County hearing challenge page"); return html;
}
export async function collectCountyEvents(now=new Date(), previous:CountyEvent[]=[],deadline=Date.now()+40000): Promise<{events:CountyEvent[];unavailable:boolean}> {
  let unavailable=false;
  const ids=new Set<string>();
  await Promise.all([-2,-1,0,1,2,3].map(async offset=>{ const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,1)); try {for(const id of parseCountyMonth(await sourceText(`/Landing/GetMonthlyHearings/${d.getUTCFullYear()}/${d.getUTCMonth()+1}`)))ids.add(id);} catch{unavailable=true;console.error("[canyon-county] Monthly hearing calendar unavailable",d.toISOString().slice(0,7));} }));
  const events=new Map(previous.map(e=>[e.id,e])); const seen=new Set<string>(); let queue=[...ids];
  // Follow the County's explicit links to earlier hearings; never join by owner name.
  for(let depth=0;queue.length&&depth<8;depth++) { const next=new Set<string>(); for(let i=0;i<queue.length;i+=8) {if(Date.now()>=deadline){unavailable=true;console.error("[canyon-county] Calendar refresh time limit reached; cached events retained");break;} await Promise.all(queue.slice(i,i+8).map(async id=>{if(seen.has(id))return;seen.add(id);try{const e=parseCountyEvent(await sourceText("/Landing/GetEventByID/"+id),id);events.set(id,e);for(const linked of e.linkedIds)if(!seen.has(linked))next.add(linked);}catch{unavailable=true;console.error("[canyon-county] Hearing detail unavailable",id);}}));}queue=[...next]; }
  return {events:[...events.values()],unavailable};
}
export async function fetchCountyFeatures(): Promise<Feature[]> {
  const features:Feature[]=[];
  for(let offset=0;offset<100000;offset+=1000) {
    const params=new URLSearchParams({where:countyCaseWhere(),outFields:"PermitNum,AppSubmitted,AppType,AppType2,Description,ParcelAddress,Status,ApprovalStatus,DecisionDate,ACCOUNT,OBJECTID",returnGeometry:"false",f:"geojson",resultOffset:String(offset),resultRecordCount:"1000",orderByFields:"OBJECTID"});
    const response=await fetch(COUNTY_CASE_LAYER+"/query?"+params,{signal:AbortSignal.timeout(15000),next:{revalidate:3600,tags:["canyon-county:cases"]}});
    if(!response.ok)throw new Error("County cases HTTP "+response.status);
    const body=await response.json() as FeatureCollection & {error?:unknown;exceededTransferLimit?:boolean;properties?:{exceededTransferLimit?:boolean}};
    if(body.error||body.type!=="FeatureCollection"||!Array.isArray(body.features))throw new Error("Invalid County case feed");
    features.push(...body.features);
    if(!body.exceededTransferLimit&&!body.properties?.exceededTransferLimit)return features;
    if(!body.features.length)throw new Error("County case pagination stalled");
  } throw new Error("County case paging limit");
}
export const canyonCounty: Locality = {slug:"canyon-county",displayName:"Canyon County",fullName:"Canyon County, Idaho",portalUrl:COUNTY_PORTAL+"/Landing",dataAttribution:"Canyon County Development Services GIS and Land Hearings Agenda",tracked:[]};
