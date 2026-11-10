import type { ScheduledMeeting } from "./localities/types";

/** Parse only an explicit continuation target, never an applicant request to continue. */
export function continuationDate(note: string | null | undefined, fromDate: string): string | undefined {
  if (!note || /(?:request(?:ed|ing)?|propos(?:ed|ing))\s+(?:to\s+)?continu/i.test(note)) return;
  const target = note.match(/\bcontinu(?:ed|ance)\s+(?:to|until)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|[A-Za-z]+\s+\d{1,2}(?:,?\s+20\d{2})?)/i)?.[1];
  if (!target) return;
  let year = Number(fromDate.slice(0, 4)), month: number, day: number, explicit = false;
  const iso = target.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const numeric = target.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (iso) { year = +iso[1]; month = +iso[2]; day = +iso[3]; explicit = true; }
  else if (numeric) { month = +numeric[1]; day = +numeric[2]; if (numeric[3]) { year = +numeric[3] + (numeric[3].length === 2 ? 2000 : 0); explicit = true; } }
  else {
    const named = target.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(20\d{2}))?$/)!;
    month = ["january","february","march","april","may","june","july","august","september","october","november","december"].findIndex(m => m === named[1].toLowerCase() || m.slice(0,3) === named[1].toLowerCase().replace(/\.$/,"")) + 1;
    day = +named[2]; if (named[3]) { year = +named[3]; explicit = true; }
  }
  const value = () => `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  if (!explicit && value() <= fromDate) year++;
  const date = value(), parsed = new Date(date + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date && date > fromDate ? date : undefined;
}

/** Keep the original event for history; the target carries no old time, agenda or deadline. */
export function scheduledContinuations(meetings: ScheduledMeeting[]): ScheduledMeeting[] {
  const grouped = new Map<string,ScheduledMeeting>();
  for (const meeting of meetings) {
    const key=meeting.body+":"+meeting.date,old=grouped.get(key);
    grouped.set(key,old?{...old,...meeting,continuedNote:meeting.continuedNote??old.continuedNote}:meeting);
  }
  meetings=[...grouped.values()];
  const targets = meetings.flatMap(m => {
    const date = continuationDate(m.continuedNote, m.date);
    return date && !meetings.some(other => other.body === m.body && other.date === date && !other.continuedNote) ? [{
      body:m.body, bodyLabel:m.bodyLabel, date, dateLabel:date, sourceUrl:m.sourceUrl,
      continuedNote:null, continuationFrom:m.date,
    }] : [];
  });
  // When a later meeting is itself continued, do not recreate it as an upcoming target.
  return [...meetings, ...targets.filter(m => !meetings.some(other => other.body === m.body && other.date === m.date))]
    .filter((m,i,all) => all.findIndex(other => other.body === m.body && other.date === m.date) === i);
}

export function continuanceHistory(events:{date:string;result?:string;note?:string;sourceUrl:string}[],nextDate?:string){
 const fmt=(d:string)=>new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(d+"T12:00:00Z"));
 return events.filter(e=>/continued|continuance/i.test((e.result??"")+" "+(e.note??""))).map(e=>{
  const text=[e.result,e.note].filter(Boolean).join(" · ");
  const from=text.match(/continued\s+from\s+([A-Za-z]+\s+\d{1,2}(?:,?\s+20\d{2})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})/i)?.[1];
  let fromDate:string|undefined;
  if(from){const parsed=Date.parse(/20\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(from)?from:from+", "+e.date.slice(0,4));if(Number.isFinite(parsed))fromDate=new Date(parsed).toISOString().slice(0,10);}
  const to=fromDate?e.date:nextDate;
  return {label:to&&to>(fromDate??e.date)?`Continued from ${fmt(fromDate??e.date)} to ${fmt(to)}`:text,source:e.sourceUrl};
 }).filter((row,index,rows)=>rows.findIndex(other=>other.label===row.label)===index);
}
