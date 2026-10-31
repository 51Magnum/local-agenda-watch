import {readFile} from "node:fs/promises";
import path from "node:path";
import {agendaAdapter} from "./adapters";
import {SourceHttp} from "./http";
import {jurisdiction} from "./registry";
import {accountForAgenda} from "./agenda-projects";
import {runSelfCheck} from "./run-self-check";
import type {StagingSnapshot} from "./store";
/** Fixture transport reuses the configured adapter; it never accesses the network. */
export async function checkFixtures(areaId:string){
 const d=jurisdiction(areaId),f=d?.selfCheck?.fixtures;if(!f)throw Error("Configure selfCheck.fixtures for an offline adapter check");
 const read=(file:string)=>{if(!/^[a-z0-9.-]+$/i.test(file))throw Error("Invalid fixture filename");return readFile(path.join(process.cwd(),"lib/jurisdictions/fixtures",file),"utf8");};
 const calendar=await read(f.calendar),meeting=await read(f.meeting);
 const http=new SourceHttp({delayMs:0,fetch:async url=>new Response(/GetCalendarMeetings|Calendar\.aspx/i.test(String(url))?calendar:meeting,{status:200})});
 const snapshot:StagingSnapshot={areaId,launchStatus:"admin_only",checkedAt:new Date().toISOString(),range:{start:f.start,end:f.end},applications:[],meetings:[],health:http.checks,skipped:[],complete:true,exclusions:{}};
 for(const source of d.agenda){const adapter=agendaAdapter(d,source,http);for(const m of await adapter.listMeetings(snapshot.range))snapshot.meetings.push(await adapter.getMeeting(m.id));}
 accountForAgenda(d,snapshot);
 if(f.boundary){const boundary=JSON.parse(await read(f.boundary));snapshot.boundary=boundary.geometry;snapshot.boundarySource={url:d.boundary.url,where:d.boundary.where};}
 return runSelfCheck(areaId,{snapshot,dryRun:true,links:async()=>({status:200,text:meeting})});
}
