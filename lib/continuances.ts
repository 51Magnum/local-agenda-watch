export function continuanceHistory(events:{date:string;result?:string;note?:string;sourceUrl:string}[],nextDate?:string){
 const fmt=(d:string)=>new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(d+"T12:00:00Z"));
 return events.filter(e=>/continued|continuance/i.test((e.result??"")+" "+(e.note??""))).map(e=>{
  const text=[e.result,e.note].filter(Boolean).join(" · ");
  const from=text.match(/continued\s+from\s+([A-Za-z]+\s+\d{1,2}(?:,?\s+20\d{2})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})/i)?.[1];
  let fromDate:string|undefined;
  if(from){const parsed=Date.parse(/20\d{2}/.test(from)?from:from+", "+e.date.slice(0,4));if(Number.isFinite(parsed))fromDate=new Date(parsed).toISOString().slice(0,10);}
  const to=fromDate?e.date:nextDate;
  return {label:to&&to>(fromDate??e.date)?`Continued from ${fmt(fromDate??e.date)} to ${fmt(to)}`:text,source:e.sourceUrl};
 });
}
