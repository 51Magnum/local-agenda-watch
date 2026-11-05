import {afterEach,expect,it,vi} from "vitest";
import {agendaProgress,collectAgendas} from "./agenda-progress";
import {jurisdiction} from "./registry";
import {SourceHttp} from "./http";
import type {Meeting} from "./adapters/types";
const h=vi.hoisted(()=>({list:vi.fn(),get:vi.fn()}));
vi.mock("./adapters",()=>({agendaAdapter:()=>({listMeetings:h.list,getMeeting:h.get})}));
const d={...jurisdiction("boise"),agenda:jurisdiction("boise").agenda.slice(0,1)},range={start:"2026-08-07",end:"2026-12-20"},now=new Date("2026-11-05T16:00:00Z");
const meeting=(id:string):Meeting=>({id,title:"Official hearing "+id,body:"pz",date:"2026-11-02",meetingPageUrl:"https://official.test/"+id,items:[],attachments:[]});
afterEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();});
it("checkpoints successful details and finishes the pending meeting without fetching completed meetings again",async()=>{
 let time=0;vi.spyOn(Date,"now").mockImplementation(()=>time);
 const a=meeting("A"),b=meeting("B"),progress=agendaProgress(d,range,now),save=vi.fn(async()=>{});
 h.list.mockResolvedValue([a,b]);h.get.mockImplementation(async id=>{time+=6000;return meeting(id);});
 const first=await collectAgendas(d,range,new SourceHttp(),30000,progress,save);
 expect(first.complete).toBe(false);expect(first.pendingMeetings).toEqual([b.meetingPageUrl]);expect(first.completedMeetings).toBe(1);expect(save).toHaveBeenCalled();
 const persisted=structuredClone(progress);time=0;h.get.mockClear();
 const resumed=agendaProgress(d,range,new Date(now.getTime()+60000),persisted);expect(resumed).toBe(persisted);
 const second=await collectAgendas(d,range,new SourceHttp(),60000,resumed,save);
 expect(second.complete).toBe(true);expect(second.meetings.map(m=>m.id).sort()).toEqual(["A","B"]);expect(h.get).toHaveBeenCalledExactlyOnceWith("B");
});
it("retries failures and changed meetings; source failure never becomes complete because cached details exist",async()=>{
 vi.spyOn(Date,"now").mockReturnValue(0);const a=meeting("A"),progress=agendaProgress(d,range,now);h.list.mockResolvedValue([a]);h.get.mockRejectedValueOnce(Error("Official source unavailable"));
 expect((await collectAgendas(d,range,new SourceHttp(),60000,progress)).complete).toBe(false);
 expect(Object.keys(Object.values(progress.sources)[0])).toHaveLength(0);
 h.get.mockResolvedValue(a);expect((await collectAgendas(d,range,new SourceHttp(),60000,progress)).complete).toBe(true);
 h.list.mockResolvedValue([{...a,title:"Revised hearing"}]);h.get.mockClear();await collectAgendas(d,range,new SourceHttp(),60000,progress);expect(h.get).toHaveBeenCalledOnce();
 h.list.mockRejectedValueOnce(Error("Calendar unavailable"));expect((await collectAgendas(d,range,new SourceHttp(),60000,progress)).complete).toBe(false);
});
it("expires old cycles and resets changed range or source configuration",()=>{
 const p=agendaProgress(d,range,now);expect(agendaProgress(d,range,now,p)).toBe(p);
 expect(agendaProgress(d,range,new Date(now.getTime()+2*3600000),p)).not.toBe(p);
 expect(agendaProgress(d,{...range,start:"2026-08-08"},now,p)).not.toBe(p);
 expect(agendaProgress({...d,agenda:[]},range,now,p)).not.toBe(p);
});
