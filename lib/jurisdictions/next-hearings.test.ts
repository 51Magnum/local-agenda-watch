import {expect,it} from "vitest";
import {nextQaHearings} from "./next-hearings";
import type {StagingSnapshot} from "./store";
it("deduplicates iQM2 meeting IDs, excludes past dates and prefers confirmed agenda evidence over hints",()=>{
 const meeting=(id:string,date:string)=>({id,date,body:"council",title:"City Council",meetingPageUrl:"https://official.test/Detail_Meeting.aspx?ID="+id,attachments:[{title:"Agenda",url:"https://official.test/agenda.pdf",kind:"agenda" as const}],items:[]});
 const snapshot:StagingSnapshot={areaId:"boise",launchStatus:"admin_only",checkedAt:"2026-10-28",range:{start:"2026-08-01",end:"2026-12-01"},complete:true,health:[],skipped:[],applications:[],meetings:[meeting("5472","2026-11-02"),meeting("5471","2026-11-02"),meeting("OLD","2026-10-27")],calendarHints:[{date:"2026-11-02",body:"council",sourceUrl:"https://official.test/calendar",tentative:true,backup:false},{date:"2026-11-09",body:"council",sourceUrl:"https://official.test/calendar",tentative:true,backup:false}]};
 const next=nextQaHearings(snapshot,"2026-10-28");expect(next).toHaveLength(2);expect(next[0]).toMatchObject({date:"2026-11-02",tentative:false,meetingUrl:"https://official.test/Detail_Meeting.aspx?ID=5471"});expect(next[1]).toMatchObject({date:"2026-11-09",tentative:true});
 expect(nextQaHearings({...snapshot,meetings:snapshot.meetings.toReversed()},"2026-10-28")).toEqual(next);
});
