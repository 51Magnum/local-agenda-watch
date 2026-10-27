import { expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const state=vi.hoisted(()=>({db:undefined as unknown as PGlite}));
vi.mock("pg",()=>({Pool:class{async query(sql:string,values?:unknown[]){return values?.length?state.db.query(sql,values):(await state.db.exec(sql)).at(-1);}}}));
import { effectiveHearingFields, readHearingMatch, saveHearingMatch, saveHearingOverride } from "./store";
it("applies the additive migration twice and retains manual overrides and date-only source values",async()=>{
 state.db=new PGlite();vi.stubEnv("DATABASE_URL","test");
 try{
  await state.db.exec("CREATE TABLE existing_project(id text PRIMARY KEY);INSERT INTO existing_project VALUES ('keep-me');");
  const schema=await readFile("migrations/20261026_hearing_meetings.sql","utf8");await state.db.exec(schema);await state.db.exec(schema);
  const row={areaId:"nampa",caseId:"ANN-00371-2026",hearingKey:"City Council:2026-11-02",data:{meeting_datetime:"2026-11-02",comment_deadline:"2026-10-28",comment_deadline_source_url:"https://www.cityofnampa.us/1722/Public-Hearings---the-Basics",meeting_url:"https://nampa.primegov.com/public/portal"},override:{},failureCount:0,lastAttemptAt:"2026-10-26T18:00:00Z"};
  await saveHearingMatch(row);await saveHearingOverride(row.areaId,row.caseId,row.hearingKey,{meeting_url:"https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10"});
  await saveHearingMatch({...row,data:{...row.data,meeting_url:"https://nampa.primegov.com/automatic"}});
  const saved=(await readHearingMatch(row.areaId,row.caseId,row.hearingKey))!;
  expect(saved.data.meeting_datetime).toBe("2026-11-02");expect(saved.data.comment_deadline).toBe("2026-10-28");expect(effectiveHearingFields(saved).meeting_url).toContain("meetingTemplateId=10");
  expect((await state.db.query("SELECT * FROM existing_project")).rows).toEqual([{id:"keep-me"}]);
  await expect(saveHearingMatch({...row,data:{comment_deadline:"2026-10-28"}})).rejects.toThrow();
 }finally{vi.unstubAllEnvs();await state.db.close();}
});
