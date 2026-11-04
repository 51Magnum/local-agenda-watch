import "server-only";
import {exceptionQueue} from "./jurisdictions/self-check-store";
import {getEvidenceStore} from "./timeline/store";
import {imageReviews} from "./maps/image-review-store";
import {approvedImageCheck} from "./maps/image-policy";
import {pendingCorrectionCount} from "./corrections";
export async function adminAttention(){
 const results=await Promise.allSettled([exceptionQueue(),getEvidenceStore().read(),imageReviews(),pendingCorrectionCount()]);
 return {
  exceptions:results[0].status==="fulfilled"?results[0].value.length:null,
  evidence:results[1].status==="fulfilled"?Object.values(results[1].value.fields).filter(f=>f.status==="pending").length:null,
  images:results[2].status==="fulfilled"?results[2].value.filter(r=>r.outcome!=="accepted"||!approvedImageCheck(r.visual?.approval)).length:null,
  corrections:results[3].status==="fulfilled"?results[3].value:null,
 };
}
