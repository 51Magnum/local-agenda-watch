import {createHash} from "node:crypto";
import type {StagingSnapshot} from "./store";
const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;
/** Approval binds reviewed evidence and completeness, rather than collection telemetry. */
export function snapshotHash(snapshot:StagingSnapshot){
 const {areaId,launchStatus,applications,meetings,boundary,coverageBoundary,impactAreas,calendarHints,visuals,aiSamples,complete,pendingMeetings}=snapshot;
 const content={areaId,launchStatus,applications:applications?.toSorted((a,b)=>a.recordId.localeCompare(b.recordId)),meetings:meetings?.toSorted((a,b)=>(a.date+a.body+a.id).localeCompare(b.date+b.body+b.id)),boundary,coverageBoundary,impactAreas,calendarHints,visuals,aiSamples,complete,pendingMeetings:pendingMeetings?.toSorted()};
 return createHash("sha256").update(JSON.stringify(stable(content))).digest("hex");
}
