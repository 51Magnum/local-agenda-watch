import {expect,it} from "vitest";
import {buildQaReport} from "./qa-builder";
import {jurisdiction} from "./registry";
import type {StagingSnapshot} from "./store";
const snapshot:StagingSnapshot={areaId:"ada-county",launchStatus:"admin_only",checkedAt:"2026-10-28",range:{start:"2026-07-30",end:"2026-12-12"},applications:[],meetings:[],complete:true,health:[],skipped:[]};
it("creates a redacted dry-run artifact that cannot satisfy recorded staging approval",()=>{
 const report=buildQaReport(jurisdiction("ada-county"),snapshot,[],{now:new Date("2026-10-28T12:00:00Z"),dryRun:true,budgetLedgerAvailable:false});
 expect(report.id).toMatch(/^dry-run-/);expect(report.passed).toBe(false);expect(report.checks).toContainEqual(expect.objectContaining({name:"recorded staging QA",passed:false}));
 expect(report.data).toMatchObject({projects:0,duplicateProjectNumbers:0,hearingLinkedProjects:0,privacyProtectedProjects:0,collectionMode:"dry-run",freshRunAiSpendUsd:0,budgetLedgerAvailable:false});
 expect(report.createdAt).toBe("2026-10-28T12:00:00.000Z");
});
it("retains every existing source/collection/matching/AI/runtime gate for durable QA",()=>{
 const report=buildQaReport(jurisdiction("ada-county"),snapshot);
 expect(report.checks.map(c=>c.name)).toEqual(["hard-fact sources","collection complete","boundary","case matching","AI sample","runtime download check"]);expect(report.passed).toBe(false);
});
