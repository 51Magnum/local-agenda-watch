import type {StagingSnapshot} from "./store";
import type {SelfCheckReport} from "./self-check";
export const DOCUMENT_NOTICE="Some official documents could not be verified. Check the linked official meeting record for the complete file.";
/** Remove only withheld URLs; never replace source facts or invent document contents. */
export function verifiedDocumentSnapshot(snapshot:StagingSnapshot,report:SelfCheckReport):StagingSnapshot{
 const urls=new Set(report.records.flatMap(r=>r.withheldDocuments?.map(d=>d.url)??[]));
 const hashes=new Map(report.records.flatMap(r=>r.verifiedDocuments?.map(d=>[d.url,d.documentHash] as const)??[]));
 if(!urls.size&&!hashes.size)return snapshot;
 const attachments=(items:StagingSnapshot["meetings"][number]["attachments"])=>items.filter(a=>!urls.has(a.url)).map(a=>({...a,documentHash:hashes.get(a.url)??a.documentHash}));
 return {...snapshot,applications:snapshot.applications.map(a=>({...a,documentNotice:report.records.find(r=>r.recordId===a.recordId)?.withheldDocuments?.length?DOCUMENT_NOTICE:undefined})),meetings:snapshot.meetings.map(m=>({...m,attachments:attachments(m.attachments),items:m.items.map(i=>({...i,attachments:attachments(i.attachments)}))}))};
}
