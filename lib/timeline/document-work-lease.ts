import {getEvidenceStore,acquireLease,releaseLease} from "./store";
/** Heavy PDF operations share the deployment instance's memory; never run two backfills together. */
export async function claimDocumentWork(){const store=getEvidenceStore(),token=await acquireLease(store,"resident-document-worker",300000);return token?()=>releaseLease(store,"resident-document-worker",token):null;}
