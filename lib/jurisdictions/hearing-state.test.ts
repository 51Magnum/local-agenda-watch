import {expect,it} from "vitest";
import {projectHearingState} from "./hearing-state";
import {jurisdiction} from "./registry";
import type {Meeting} from "./adapters/types";
const d=jurisdiction("ada-county"),meeting:Meeting={id:"pzc",title:"PZC",body:"pzc",date:"2026-11-19",startsAt:"2026-11-20T01:00:00.000Z",meetingPageUrl:"https://official.test/agenda",attachments:[],items:[]};
it("uses confirmed agenda time, signup and deadlines",()=>{
 const state=projectHearingState(d,[meeting],"2026-10-28T12:00:00Z","2026-10-28");
 expect(state.next?.startsAt).toBe(meeting.startsAt);expect(state.commentUrl).toBe(d.participation.testimonySignupUrl);
 expect(state.deadlines).toHaveLength(2);expect(state.noHearing).toBeUndefined();
});
it("gives a dated message and official discovery links without signup or deadlines when none is confirmed",()=>{
 const state=projectHearingState(d,[{...meeting,tentative:true},{...meeting,date:"2026-10-15"}],"2026-10-28T12:00:00Z","2026-10-28");
 expect(state.next).toBeUndefined();expect(state.commentUrl).toBeUndefined();expect(state.deadlines).toEqual([]);
 expect(state.noHearing?.message).toBe("No hearing scheduled in official agendas as of 2026-10-28.");
 expect(state.noHearing?.sources).toEqual([{label:"Official hearings and agendas",url:d.participation.hearingsUrl},{label:"Legal notices",url:d.participation.legalNoticesUrl}]);
});
