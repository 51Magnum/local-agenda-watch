import type {StagingSnapshot} from "./store";
export function nextQaHearings(snapshot:StagingSnapshot,today=new Date().toISOString().slice(0,10)){
 const candidates=[...snapshot.meetings.map(m=>({date:m.date,body:m.body,meetingUrl:m.meetingPageUrl,tentative:m.tentative??!(m.items.length||m.attachments.some(a=>a.kind==="agenda")),quality:m.items.length+Number(m.attachments.some(a=>a.kind==="agenda"))})),...(snapshot.calendarHints??[]).filter(m=>!m.backup).map(m=>({date:m.date,body:m.body,meetingUrl:m.sourceUrl,tentative:true,quality:0}))];
 candidates.sort((a,b)=>a.date.localeCompare(b.date)||a.body.localeCompare(b.body)||Number(a.tentative)-Number(b.tentative)||b.quality-a.quality||a.meetingUrl.localeCompare(b.meetingUrl));
 const unique=new Map<string,typeof candidates[number]>();
 for(const row of candidates)if(row.date>=today&&!unique.has(row.body+":"+row.date))unique.set(row.body+":"+row.date,row);
 return [...unique.values()].slice(0,2).map(({quality,...row})=>{void quality;return row;});
}
