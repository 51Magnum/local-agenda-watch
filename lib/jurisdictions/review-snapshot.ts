import type {AreaDefinition} from "../areas/registry";
import type {PaneData} from "../maps/project-questions";
import type {MapSnapshot} from "../maps/types";
import type {HearingFeed} from "../localities/types";
import type {SelfCheckReport} from "./self-check";
import {reviewSnapshots} from "./generated";
export type ReviewSnapshot={version:1;status:"review";areaId:string;collectedAt:string;sourceSnapshotHash:string;area:AreaDefinition;selfCheck:SelfCheckReport;records:{caseId:string;aliases:string[];eligible:boolean;project:PaneData}[];feed:HearingFeed;map:MapSnapshot};
/** Generated static imports ensure the same committed artifact ships to every runtime. */
export function readReviewSnapshot(id:string):ReviewSnapshot|undefined{return (reviewSnapshots as unknown as Record<string,ReviewSnapshot>)[id];}
export const allReviewSnapshots=()=>Object.values(reviewSnapshots) as unknown as ReviewSnapshot[];
export function snapshotDrift(expected:ReviewSnapshot|undefined,actual:SelfCheckReport,maxChangedRecords=3){
 if(!expected)return {pass:false,reason:"No committed review snapshot exists for this jurisdiction."};
 // Report titles are deliberately redacted in the artifact. Source hashes cover
 // application copy and linked evidence without exposing those private fields.
 const signature=(r:SelfCheckReport["records"][number])=>JSON.stringify([r.publish,!!r.hidden,r.sourceHash,r.checks?.map(c=>[c.check,c.status])]);
 const before=new Map(expected.selfCheck.records.map(r=>[r.recordId,signature(r)])),after=new Map(actual.records.map(r=>[r.recordId,signature(r)]));
 const changed=[...new Set([...before.keys(),...after.keys()])].filter(id=>!before.has(id)||!after.has(id)||before.get(id)!==after.get(id)).length;
 const pass=changed<=maxChangedRecords&&expected.selfCheck.goLive===actual.goLive;
 return {pass,changed,reason:pass?`Live checks match the committed decision (${changed} records changed).`:`Live checks differ from the committed review: ${changed} records changed; reviewed go-live ${expected.selfCheck.goLive}, live go-live ${actual.goLive}. Refresh the review snapshot before launch.`};
}
