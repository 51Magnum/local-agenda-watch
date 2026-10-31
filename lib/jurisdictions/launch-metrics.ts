import type {StagingSnapshot} from "./store";
import {residentialCase} from "../residential-privacy";
import {jurisdiction} from "./registry";
export function launchMetrics(snapshot:StagingSnapshot){
 const apps=snapshot.applications,number=(a:typeof apps[number])=>a.projectNumber??a.recordId.match(/^\d{9}/)?.[0]??a.recordId;
 const protectedApps=apps.filter(a=>residentialCase(snapshot.areaId,a.recordId,a));
 const appearances=(a:typeof apps[number])=>snapshot.meetings.filter(m=>m.items.some(i=>i.caseNumbers.some(id=>[a.recordId,...a.relatedCaseNumbers].includes(id))||i.matchedApplications?.some(match=>match.recordId===a.recordId)));
 return {projects:apps.length,duplicateProjectNumbers:apps.length-new Set(apps.map(number)).size,hearingLinkedProjects:apps.filter(a=>appearances(a).length).length,privacyProtectedProjects:protectedApps.length,privacyProtectedProjectIds:protectedApps.map(a=>a.recordId),projectsBeforeScope:snapshot.collectionStats?.projectsBeforeScope,excludedByScope:snapshot.collectionStats?.excludedByScope,reviewedOldHeardProjects:(jurisdiction(snapshot.areaId)?.selfCheck?.mustInclude??[]).map(id=>{const a=apps.find(a=>number(a)===id);return {projectNumber:id,present:!!a,recordUrl:a?.recordUrl,hearingDates:a?appearances(a).map(m=>m.date):[],hearingSources:a?appearances(a).map(m=>({date:m.date,url:m.meetingPageUrl})):[]};})};
}
