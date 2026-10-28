import type {StagingSnapshot} from "./store";
import {residentialCase} from "../residential-privacy";
export const ADA_REVIEW_PROJECTS=["202600273","202601088","202600638","202601398","202601317","202600819","202600934","202103209"];
export function launchMetrics(snapshot:StagingSnapshot){
 const apps=snapshot.applications,number=(a:typeof apps[number])=>a.projectNumber??a.recordId.match(/^\d{9}/)?.[0]??a.recordId;
 const appearances=(a:typeof apps[number])=>snapshot.meetings.filter(m=>m.items.some(i=>i.caseNumbers.some(id=>[a.recordId,...a.relatedCaseNumbers].includes(id))||i.matchedApplications?.some(match=>match.recordId===a.recordId)));
 return {projects:apps.length,duplicateProjectNumbers:apps.length-new Set(apps.map(number)).size,hearingLinkedProjects:apps.filter(a=>appearances(a).length).length,privacyProtectedProjects:apps.filter(a=>residentialCase(snapshot.areaId,a.recordId,a)).length,projectsBeforeScope:snapshot.collectionStats?.projectsBeforeScope,excludedByScope:snapshot.collectionStats?.excludedByScope,reviewedOldHeardProjects:ADA_REVIEW_PROJECTS.map(id=>{const a=apps.find(a=>number(a)===id);return {projectNumber:id,present:!!a,hearingDates:a?appearances(a).map(m=>m.date):[]};})};
}
