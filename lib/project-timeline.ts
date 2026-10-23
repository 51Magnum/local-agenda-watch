import type { ProjectStage } from "./projects";
import { PROJECT_STAGES } from "./projects";
import { latestField, type TimelineData } from "./timeline/public";
import { DECISION_KEYS, evidenceSourceHref, type EvidenceField, type FieldKey } from "./timeline/types";
export type ProjectTimelineRow = { stage: ProjectStage; date?: string; text: string; source?: string; caseIds?: string[]; vote?: string; support?: string; opposition?: string; sources?: string[] };
export function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {timeZone:"America/Denver",month:"short",day:"numeric",year:"numeric"}).format(new Date(value.length===10?value+"T12:00:00-07:00":value));
}
export function hearingDay(value: string) { return value.length===10?value:new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver"}).format(new Date(value)); }
export function projectTimelineRows(data: TimelineData, today = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver"}).format(new Date())): ProjectTimelineRow[] {
  const fields = data.fields.filter((f) => !DECISION_KEYS.has(f.key) || f.status === "approved");
  const rows: ProjectTimelineRow[] = [];
  for (const stage of PROJECT_STAGES) {
    const dateKey: FieldKey = stage === "Submitted" ? "appliedDate" : stage === "Under review" ? "reviewDate" : stage === "P&Z hearing" ? "pzHearingDate" : stage === "Council hearing" ? "councilHearingDate" : "decisionDate";
    if (stage === "Submitted" || stage === "Under review") {
      const dated = data.caseIds.map((id) => latestField(fields.filter(f=>f.caseId===id),dateKey)).filter((f): f is EvidenceField => Boolean(f));
      const days = new Map<string,EvidenceField>(); for(const f of dated) days.set(f.value,f);
      for(const field of days.values()) rows.push({stage,date:field.value,text:(stage==="Submitted"?"Application submitted":"Review began")+", "+shortDate(field.value),source:evidenceSourceHref(field),caseIds:days.size>1?dated.filter(f=>f.value===field.value).map(f=>f.caseId):undefined});
      if(!days.size && stage==="Under review") { const report=fields.find(f=>f.sourceKind==="staff-report"); if(report) rows.push({stage,text:"Staff report available",source:evidenceSourceHref(report)}); }
      continue;
    }
    if(stage==="Decided") {
      if(data.finalDecisionApproved) {const date=latestField(fields,"decisionDate"),result=latestField(fields,"councilDecision"); rows.push({stage,date:date?.value,text:"Final decision recorded"+(date?", "+shortDate(date.value):""),source:result?evidenceSourceHref(result):undefined});}
      else if(data.currentStage==="Decided"&&data.statusSource) rows.push({stage,text:"Marked decided in the city record",source:data.statusSource});
      continue;
    }
    const pz=stage==="P&Z hearing",body=pz?/P&Z|Planning/i:/Council|Board/i;
    const date=latestField(fields,dateKey),upcoming=data.next&&body.test(data.next.body)?data.next:undefined;
    const appearance=[...data.appearances].reverse().find(a=>a.isHearing&&body.test(a.body));
    const fallbackDay=date?.value??(upcoming?hearingDay(upcoming.startsAt):undefined)??appearance?.date;
    const results=data.caseIds.map(id=>latestField(fields.filter(f=>f.caseId===id),pz?"pzResult":"councilDecision")).filter((f):f is EvidenceField=>Boolean(f));
    const grouped=new Map<string,ProjectTimelineRow>();
    for(const result of results){
      const related=fields.filter(f=>f.caseId===result.caseId&&f.documentId===result.documentId);
      const day=latestField(related,pz?"pzHearingDate":"decisionDate")?.value??fallbackDay;
      const sameMeetingMinutes = fields.filter(f => f.caseId === result.caseId && f.sourceKind === "minutes" && fields.some(dateField => dateField.documentId === f.documentId && dateField.caseId === result.caseId && dateField.key === dateKey && dateField.value === day));
      const voteField=latestField(related,pz?"pzVote":"councilVote")??latestField(sameMeetingMinutes,pz?"pzVote":"councilVote");
      const supportField=pz?latestField(sameMeetingMinutes,"pzSpeakersFor"):undefined,oppositionField=pz?latestField(sameMeetingMinutes,"pzSpeakersAgainst"):undefined;
      const vote=voteField?.value,support=supportField?.value,opposition=oppositionField?.value;
      const sources=[...new Set([result,voteField,supportField,oppositionField].filter((f):f is EvidenceField=>Boolean(f)).map(evidenceSourceHref))];
      const text=pz?result.value==="recommend approval"?"Recommended approval":result.value==="recommend denial"?"Recommended denial":"Hearing continued":result.value.charAt(0).toUpperCase()+result.value.slice(1);
      const key=JSON.stringify([day,result.value,vote,support,opposition]);const existing=grouped.get(key);
      if(existing){existing.caseIds!.push(result.caseId);existing.sources=[...new Set([...(existing.sources??[]),...sources])];}else grouped.set(key,{stage,date:day,text:text+(day?", "+shortDate(day):""),source:evidenceSourceHref(result),sources,caseIds:[result.caseId],vote,support,opposition});
    }
    if(grouped.size){for(const row of grouped.values())rows.push({...row,caseIds:grouped.size>1||results.length<data.caseIds.length?row.caseIds:undefined});}
    else if(fallbackDay && !(data.currentStage==="Decided" && fallbackDay>today))rows.push({stage,date:fallbackDay,text:fallbackDay<=today?"Met "+shortDate(fallbackDay)+", result pending minutes or decision letter.":"Upcoming: "+shortDate(fallbackDay),source:date?evidenceSourceHref(date):upcoming?.agendaUrl??upcoming?.sourceUrl??appearance?.sourceUrl});
    else if(stage===data.currentStage)rows.push({stage,text:pz?"No hearing scheduled yet.":"Council date not set"});
  }
  return rows;
}
