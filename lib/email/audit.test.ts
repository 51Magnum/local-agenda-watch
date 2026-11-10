import { expect, it } from "vitest";
import { alertFixture } from "../../tests/fixtures/alert-regressions";
import { emailProject } from "./project";
import { auditEmailProject } from "./audit";
const now=new Date("2026-11-10T19:00:00Z");
it("reports missing case numbers, contradictory states, failed links, and omitted official records",()=>{
 const p=emailProject(alertFixture(),undefined,undefined,now);
 p.snapshot.caseId="";p.snapshot.caseNumbers=[];p.snapshot.status="Approved";p.snapshot.normalizedStatus="under_review";p.snapshot.officialRecordUrl=undefined;
 p.linkChecks={"https://official.example.test/broken":{ok:false,reason:"HTTP 404"}};
 expect(auditEmailProject(p,now).map(f=>f.kind)).toEqual(["missing_case_number","contradictory_status","omitted_link","failed_link"]);
});
it("accepts a consistent pending case after removing expired action copy",()=>{
 const p=emailProject(alertFixture(),undefined,undefined,now);expect(auditEmailProject(p,now)).toEqual([]);
});
it("flags expired instructions leaked through an otherwise stale snapshot",()=>{
 const d=alertFixture();d.next!.startsAt="2026-11-12";d.next!.commentDeadline="2026-11-09";
 const p=emailProject(d,undefined,undefined,now);p.snapshot.next!.deadline=undefined;p.snapshot.next!.deadlineSource=undefined;d.next!.commentDeadline=undefined;d.next!.commentSourceUrl=undefined;p.data.expiredDeadlineMessage="Sign up to speak and submit exhibits.";
 expect(auditEmailProject(p,now).some(f=>f.kind==="expired_action")).toBe(true);
 // A malformed cached status cannot mask a hearing that has actually passed.
 d.next!.startsAt="2026-11-05";p.snapshot.normalizedStatus="under_review";
 expect(auditEmailProject(p,now).some(f=>f.kind==="contradictory_status")).toBe(true);
});
