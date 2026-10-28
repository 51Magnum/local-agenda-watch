import {denverInstant} from "../../case-details";
import type {Meeting,Attachment} from "./types";
import type {JurisdictionDefinition} from "../types";

export function adaDocumentCases(filename:string){
 return [...filename.toUpperCase().matchAll(/\b\d{9}(?:-[A-Z]{1,12})+/g)].map(m=>m[0].split(/-(?:MEMO|FINDINGS|STAFF|REPORT|REVISED|DRAFT|TABLING|PZC|BOCC)(?:-|_|$)/)[0]);
}
export function adaDocumentLabel(kind:Attachment["kind"]){
 return ({staff_report:"Staff report",agenda:"Agenda",findings:"Findings",memo:"Memo",minutes:"Minutes",packet:"Meeting packet",other:"Official attachment"})[kind];
}
/** Agenda text is evidence only. Header applicants are deliberately not retained. */
export function parseAdaAgenda(text:string,meeting:Meeting,config:JurisdictionDefinition):Meeting{
 const time=text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(A\.?\s*M\.?|P\.?\s*M\.?)\b/i);
 const hour=time?(Number(time[1])%12+(/p/i.test(time[3])?12:0)):undefined;
 const startsAt=time?denverInstant(meeting.date,String(hour).padStart(2,"0")+":"+(time[2]??"00"),config.timezone):undefined;
 const headers=[...text.matchAll(/(?:^|\n)\s*(\d+)\.\s*((?:\d{9}(?:-[A-Z]{1,5})+)(?:\s*&\s*\d{9}(?:-[A-Z]{1,5})+)*)\s*,\s*([^\n]*)(?:\n|$)/g)];
 const items=headers.flatMap((h,index)=>{
  const end=headers[index+1]?.index??text.length,section=text.slice(h.index!+h[0].length,end);
  // BOCC uses a colon on the applicant header; PZC puts the description on the next line.
  const lead=h[3].includes(":")?h[3].slice(h[3].indexOf(":")+1).trim()+"\n":"";
  const body=lead+section;
  const title=body.split(/(?:Staff|P&Z|PZC)\s+Recommendation\s*:|\bStaff\s*:|(?:^|\n)\s*[IVX]+\.\s|Public (?:Hearing|Meetings)/i)[0].replace(/\f/g," ").replace(/\s+/g," ").trim();
  if(!title)return [];
  const caseNumbers=h[2].match(/\d{9}(?:-[A-Z]{1,5})+/g)!;
  const sourcePage=text.slice(0,h.index).split("\f").length;
  const recommendation=(label:string)=>body.match(new RegExp(label+"\\s+Recommendation\\s*:\\s*(Approval|Denial|Table[^\\n]*?)(?=\\s+[A-Z][a-z]+\\s+[A-Z][a-z]+|\\n|$)","i"))?.[1]?.trim();
  const tabled=body.match(/\(?Tabled from[^\n)]*\)?/i)?.[0];
  return [{itemId:h[1]+":"+caseNumbers[0],title,caseNumbers,body:meeting.body,meetingDateTime:startsAt??meeting.date,meetingPageUrl:meeting.meetingPageUrl,itemUrl:meeting.meetingPageUrl+"#page="+sourcePage,sourcePage,staffRecommendation:recommendation("Staff"),bodyRecommendation:recommendation("(?:P&Z|PZC)"),tabledNote:tabled,attachments:meeting.attachments.filter(a=>a.kind!=="agenda"&&(a.caseNumbers??[]).some(id=>caseNumbers.some(c=>c.split("-")[0]===id.split("-")[0])))}];
 });
 return {...meeting,startsAt,items};
}
