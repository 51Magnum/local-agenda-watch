import { denverDay, isFutureHearing, normalizeCaseState, terminalCaseState } from "../case-state";
import { snapshotClosed, type EmailProject } from "./project";
import { projectBlock } from "./templates";

export type AlertAuditFlag={kind:"missing_case_number"|"contradictory_status"|"expired_action"|"failed_link"|"omitted_link";detail:string};
/** Audit the same rendered project block that would enter the digest, without delivering it. */
export function auditEmailProject(project:EmailProject,now=new Date()):AlertAuditFlag[] {
 const s=project.snapshot,flags:AlertAuditFlag[]=[];
 if(!s.caseId?.trim()||!/[0-9]/.test(s.caseId)||!s.caseNumbers?.length||s.caseNumbers.some(id=>!id.trim()||!/[0-9]/.test(id)))flags.push({kind:"missing_case_number",detail:"An official case number is missing or invalid"});
 const upcoming=!!s.next&&isFutureHearing(s.next.startsAt,now);
 const closed=project.data.participationClosed||["Decided","Recorded"].includes(project.data.item.stage);
 const intermediate=upcoming&&!closed&&terminalCaseState(s.status)==="approved";
 const expected=normalizeCaseState(intermediate?"Pending":closed&&!terminalCaseState(s.status)?"Closed":s.status,s.next?.startsAt,s.lastHearing,now);
 if(s.normalizedStatus!==expected||snapshotClosed(s)&&!!s.next)flags.push({kind:"contradictory_status",detail:"Normalized status contradicts the official status or hearing date"});
 const action=projectBlock(project,now).text.split("How can I act?")[1]??"";
 const deadline=s.next?.deadline,expiredDeadline=!!deadline&&(deadline.length===10?deadline<denverDay(now):Date.parse(deadline)<=now.getTime());
 const expired=!!project.data.expiredDeadlineMessage||closed||s.normalizedStatus==="hearing_passed_decision_pending"||!!project.data.next&&!isFutureHearing(project.data.next.startsAt,now)||expiredDeadline;
 if(expired&&/sign[ -]?up to speak|submit (?:written )?comments|submit exhibits|comment deadline:/i.test(action))flags.push({kind:"expired_action",detail:"Participation invitation appears after the hearing/deadline or case closure"});
 if(!s.officialRecordUrl)flags.push({kind:"omitted_link",detail:"No case-specific official record link is available"});
 for(const [url,result]of Object.entries(project.linkChecks??{}))if(!result.ok)flags.push({kind:"failed_link",detail:url+" — "+result.reason});
 return flags;
}
