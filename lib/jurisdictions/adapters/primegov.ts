import {parsePrimeGovMeetings,parsePrimeGovAgenda} from "../../sources/primegov";
import {SourceHttp} from "../http";
import type {AgendaSource,JurisdictionDefinition} from "../types";
import type {AgendaAdapter,Meeting} from "./types";
import {bodyKey} from "./common";
export function primegovAdapter(config:JurisdictionDefinition,source:AgendaSource,http:SourceHttp):AgendaAdapter {
 const base=new URL(String(source.params.baseUrl)).origin,known=new Map<string,Meeting>();
 return{listMeetings:async range=>{const raw=await http.json(base+"/api/v2/PublicPortal/ListUpcomingMeetings");const meetings=parsePrimeGovMeetings(raw).flatMap(m=>{const body=bodyKey(config,m.title);if(!body||m.date<range.start||m.date>range.end)return [];return[{id:m.id,title:m.title,body,date:m.date,meetingPageUrl:(m.meetingUrl??m.sourceUrl).replace("https://nampa.primegov.com",base),attachments:[],items:[]} as Meeting];});meetings.forEach(m=>known.set(m.id,m));return meetings;},getMeeting:async id=>{const m=known.get(id);if(!m)throw Error("List meetings first");const items=parsePrimeGovAgenda(await http.text(m.meetingPageUrl),m.meetingPageUrl);return{...m,items:items.map(i=>({itemId:i.itemNumber??i.title,title:i.title,caseNumbers:i.caseIds,body:m.body,meetingDateTime:m.date,meetingPageUrl:m.meetingPageUrl,attachments:[]}))};},healthcheck:async()=>{try{await http.json(base+"/api/v2/PublicPortal/ListUpcomingMeetings");}catch{}return http.checks;}};
}
