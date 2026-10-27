import {load} from "cheerio";
import type {JurisdictionDefinition} from "../types";
import type {Attachment} from "./types";
export const clean=(s:unknown)=>String(s??"").replace(/\s+/g," ").trim();
export function caseNumbers(config:JurisdictionDefinition,text:string){return [...new Set(config.caseNumberPatterns.flatMap(p=>[...text.toUpperCase().matchAll(new RegExp(p,"gi"))].map(m=>m[0])))];}
export function attachmentKind(title:string,url=""):Attachment["kind"]{
 if(/staff[ _-]*report|project[ _-]*report|\bACHD\b|agency[ _-]*report|traffic[ _-]*(?:study|report)/i.test(title))return "staff_report";
 if(/packet|full.?package|agenda.?package|Type=1(?:&|$)/i.test(title+" "+url))return "packet";
 if(/minutes|postminutes/i.test(title))return "minutes";
 if(/findings/i.test(title))return "findings";
 if(/memo/i.test(title))return "memo";
 if(/agenda/i.test(title))return "agenda";
 return "other";
}
export function links(html:string,base:string):Attachment[]{const $=load(html);return [...new Map($("a[href]").toArray().flatMap(el=>{if($(el).closest("nav,.breadcrumb,#breadcrumbs").length)return [];const href=$(el).attr("href")!,title=clean($(el).text()||$(el).attr("title")||href);let url:string;try{url=new URL(href,base).href;}catch{return [];}if(!/^https:/.test(url)||!/FileStream\.ashx|FileOpen\.aspx|OpenDocument|\.pdf(?:[?#]|$)|\.sharepoint\.com|Browse\.aspx|\/libraries\//i.test(url))return [];return [[url,{title,url,kind:attachmentKind(title,url)}] as const];})).values()];}
export function bodyKey(config:JurisdictionDefinition,name:string){const n=clean(name).toLowerCase().replace(/&/g,"and");return config.hearingBodies.find(b=>new RegExp(b.agendaBodyMatch,"i").test(name)||n===b.name.toLowerCase())?.key;}
export function sourceDate(value:unknown,timezone:string){const s=String(value??"");const local=s.match(/^(\d{4})[/-](\d{2})[/-](\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/);if(local)return local.slice(1,4).join("-");const ms=s.match(/\/Date\((\d+)/)?.[1];const date=ms?new Date(Number(ms)):new Date(s);if(Number.isNaN(date.getTime()))throw Error("Unrecognized source date");return new Intl.DateTimeFormat("en-CA",{timeZone:timezone}).format(date);}
export function allowedAttachment(a:Attachment,config:JurisdictionDefinition){return a.kind!=="packet"&&(!a.sizeBytes||a.sizeBytes<=config.documents.maxBytes)&&!/sign.?in|attendance|sign.?up.?sheet/i.test(a.title);}
