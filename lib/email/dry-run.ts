import { auditEmailProject } from "./audit";
import type { Subscription } from "../alerts";
import type { MapCase } from "../maps/types";
import { projectDetail } from "../maps/project-detail";
import { loadWatchProjects } from "./jobs";
import { createLinkChecker, verifyProjectLinks, type LinkChecker } from "./links";
import { rankProjects } from "./project";
import { digestTemplates } from "./templates";

/** Read and build only: no queue, mail provider, baseline update, or subscriber token. */
export async function previewWatch(sub:Subscription,rows:MapCase[],now=new Date(),load=projectDetail,check:LinkChecker=createLinkChecker()) {
  const projects=rankProjects(await loadWatchProjects(sub,rows,load,now),now);
  const verified=await Promise.all(projects.map(p=>verifyProjectLinks(p,check)));
  const report=verified.map(p=>({caseNumber:p.snapshot.caseId,caseNumbers:p.snapshot.caseNumbers,status:p.snapshot.normalizedStatus,nextHearing:p.snapshot.next?.startsAt??null,
    included:!!p.changes.length,reason:p.changes.length?p.changes:["Baseline or unchanged record; no update email"],officialRecord:p.snapshot.officialRecordUrl??null,linkChecks:p.linkChecks,flags:auditEmailProject(p,now)}));
  const changed=verified.filter(p=>p.changes.length);
  const messages=changed.length?digestTemplates(changed,{mailingAddress:"DRY RUN — no delivery",unsubscribe:"https://preview.invalid/unsubscribe",manage:"https://preview.invalid/manage",test:true},sub.target.kind==="place"?sub.target.label:undefined,false,now):[];
  return {at:now.toISOString(),report,messages};
}
