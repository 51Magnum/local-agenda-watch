import {load} from "cheerio";
import type {JurisdictionDefinition} from "./types";
import type {Meeting} from "./adapters/types";
import {bodyKey} from "./adapters/common";
export function matchSignupEvents(config:JurisdictionDefinition,meetings:Meeting[],events:{title:string;start:string;url:string}[],baseUrl:string){
 return meetings.map(m=>{const matches=events.filter(e=>!/(?:cancel[le]d|work\s*session|strategic planning)/i.test(e.title)&&e.start.slice(0,10)===m.date&&bodyKey(config,e.title)===m.body);return matches.length===1?{...m,testimonySignupUrl:new URL(matches[0].url,baseUrl).href}:m;});
}
export type CalendarHint={date:string;body:string;sourceUrl:string;tentative:true;backup:boolean};
export function parseTentativeTable(html:string,sourceUrl:string,year:number,tables:{index:number;body:string}[]):CalendarHint[]{
 const $=load(html),months=["january","february","march","april","may","june","july","august","september","october","november","december"],hints:CalendarHint[]=[];
 for(const table of tables){const node=$("table").eq(table.index);for(const row of node.find("tr").toArray()){const cells=$(row).find("td").map((_,el)=>$(el).text().trim()).get(),month=months.indexOf(cells[0]?.toLowerCase());if(month<0)continue;for(const [index,cell]of cells.slice(1).entries()){if(!/^\d{1,2}$/.test(cell))continue;const day=Number(cell),date=year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");if(new Date(date+"T12:00:00Z").toISOString().slice(0,10)===date)hints.push({date,body:table.body,sourceUrl,tentative:true,backup:index>0});}}}
 return hints;
}
