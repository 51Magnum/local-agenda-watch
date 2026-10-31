import {applicationRecordUrl} from "./application-source";
import {verificationUrl,sourceRecordId,restrictedRecordData,recordDataIssue,officialDocument,filenameIdentifies} from "./record-links";
import {attachmentKind} from "./adapters/common";
import {createHash} from "node:crypto";
import type {Application} from "./adapters/types";
import type {JurisdictionDefinition} from "./types";
import type {StagingSnapshot} from "./store";
import {snapshotHash} from "./snapshot-hash";
import {applicationTitle,primaryType,procedureTitleLabel} from "./application-copy";
import {coverageEligible} from "./application-geolocation";
import {collectionCoverage} from "./boundary-source";
import {assertCollectionComplete,projectNumber} from "./agenda-projects";
import {individualApplicant} from "./application-scope";
import {projectHearingState} from "./hearing-state";
export type CheckName="title-from-source"|"description-verbatim"|"link-resolves-to-case"|"location-in-boundary"|"case-identity"|"privacy"|"ai-labeled"|"stage-and-date";
export type Check={check:string;status:"pass"|"fail"|"uncertain";reason:string;sourceUrl:string;retry?:boolean};
export type LinkEvidence={status:number;text:string;privacyReviewed?:boolean;reason?:string;documentHash?:string;evidenceHash?:string;readable?:boolean};
export type Proposal={title?:string;hideDocuments?:boolean;reason:string;aiGenerated:true;sourceUrls:string[]};
export type ExceptionDecision={areaId:string;recordId:string;sourceHash:string;action:"approve"|"fix"|"hide";reviewer:string;proposal?:Proposal};
export type RecordChecks={recordId:string;sourceHash:string;checks:Check[];publish:boolean;title:string;proposal?:Proposal;reviewer?:string;hidden?:boolean};
export type SelfCheckReport={areaId:string;createdAt:string;snapshotHash:string;passRate:number;records:RecordChecks[];counts:Record<string,{pass:number;fail:number;uncertain:number}>;coverage:Check[];agendaItems:{accounted:number;total:number};unmatched:{caseIds:string[];sourceUrl:string;reason:string}[];exclusions:Record<string,number>;queue:{recordId:string;sourceHash:string;check:Check;proposal?:Proposal}[];aiCostUsd:number;goLive:boolean;decision:string};
export const sourceHash=(a:Application)=>createHash("sha256").update(JSON.stringify([a.recordId,a.relatedCaseNumbers,a.type,a.description,a.sourceFields,a.recordUrl,a.geometry])).digest("hex");
const words=(text:string):string[]=>text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
export function titleFromSource(title:string,a:Application,order?:string[]){
 const source=new Set(words(a.type+" "+a.description));
 const prefix=title.split(":")[0],primary=primaryType(a,order),label=words(primary).join(" ");
 if(title.includes(":")&&procedureTitleLabel(prefix)&&words(prefix).join(" ")!==label)return false;
 const generic=new Set(words(a.type+" application approval for the request proposed allow permit and of to with an a existing updated previously planning"));
 const subject=words(a.description).filter(w=>w.length>=3&&!generic.has(w));
 return !!title&&title.length<=70&&!title.includes("…")&&words(title).every(w=>source.has(w))&&(subject.length?subject.some(w=>words(title).includes(w)):words(title).join(" ")===label);
}
export function verifiedProposal(a:Application,p:Proposal,order?:string[]){
 if(!p.sourceUrls.includes(a.sourceUrl))return false;if(!p.title)return !!p.hideDocuments;
 const deterministic=applicationTitle(primaryType(a,order),a.description),extractive=words(a.description).join(" ").includes(words(p.title).join(" "));
 return titleFromSource(p.title,a,order)&&(p.title===deterministic||extractive&&!/\b(?:approved|denied|adopted|rejected|completed)\b/i.test(p.title));
}
export async function selfCheck(d:JurisdictionDefinition,snapshot:StagingSnapshot,options:{previous?:StagingSnapshot;links?:(url:string)=>Promise<LinkEvidence>;decisions?:ExceptionDecision[];now?:Date}={}):Promise<SelfCheckReport>{
 const createdAt=(options.now??new Date()).toISOString(),cache=new Map<string,Promise<LinkEvidence>>();
 const evidence=(url:string)=>{if(!cache.has(url))cache.set(url,options.links?options.links(url).catch(()=>({status:0,text:""})):Promise.resolve({status:0,text:""}));return cache.get(url)!;};
 const records:RecordChecks[]=[];
 for(const a of snapshot.applications){
  const checks:Check[]=[],add=(check:CheckName,status:Check["status"],reason:string,sourceUrl=a.sourceUrl)=>checks.push({check,status,reason,sourceUrl});
  const ownItems=snapshot.meetings.flatMap(m=>m.items.filter(i=>i.matchedApplications?.some(match=>match.recordId===a.recordId)||i.caseNumbers.some(id=>[a.recordId,...a.relatedCaseNumbers].includes(id))).map(i=>({m,i})));
  const attachments=ownItems.flatMap(({i})=>i.attachments.filter(f=>f.kind!=="packet"));
  const primary=a.residentialPrivacy?(ownItems[0]?.i.itemUrl??ownItems[0]?.m.meetingPageUrl??d.participation.hearingsUrl??a.recordUrl):a.recordUrl;
  const verify=!a.agendaOnly&&!a.residentialPrivacy&&d.recordLinks?verificationUrl(d,sourceRecordId(d,a)):undefined;
  const allLinks=[...new Set([primary,...verify?[verify]:[],...ownItems.flatMap(({m,i})=>[i.itemUrl??m.meetingPageUrl,...a.residentialPrivacy?[]:i.attachments.filter(f=>f.kind!=="packet").map(f=>f.url)])])].sort();
  const sourceContents=[];for(const url of allLinks){const proof=await evidence(url);sourceContents.push([url,proof.documentHash??proof.evidenceHash??createHash("sha256").update(proof.text).digest("hex")]);}
  const hash=createHash("sha256").update(JSON.stringify([sourceHash(a),sourceContents])).digest("hex"),decision=options.decisions?.find(r=>r.areaId===d.id&&r.recordId===a.recordId&&r.sourceHash===hash);
  const title=a.residentialPrivacy?"Residential permit request":decision?.action==="fix"&&decision.proposal?.title&&verifiedProposal(a,decision.proposal,d.selfCheck?.typeOrder)?decision.proposal.title:a.selfCheckTitle??applicationTitle(primaryType(a,d.selfCheck?.typeOrder),a.description);
  add("title-from-source",a.residentialPrivacy||titleFromSource(title,a,d.selfCheck?.typeOrder)?"pass":"fail","Title must use source words, include the subject, and fit within 70 characters.");
  const descriptionField=(d.applications.params.fields as Record<string,string>|undefined)?.description,sourceDescription=descriptionField?a.sourceFields[descriptionField]:undefined;
  add("description-verbatim",a.residentialPrivacy||a.agendaOnly||typeof sourceDescription==="string"&&sourceDescription===a.description?"pass":"uncertain",a.residentialPrivacy?"Residential description withheld.":"Displayed description must equal the captured official description exactly.");
  const links=allLinks.filter(url=>!decision?.proposal?.hideDocuments||!attachments.some(f=>f.url===url));
  let linkStatus:Check["status"]="pass",linkReason="Case links verified using source identity, official document filenames or the configured exact-record query.",linkSource=primary,linkRetry=false;
  const rejectLink=(status:"fail"|"uncertain",reason:string,url:string,retry=false)=>{if(linkStatus==="fail"&&status==="uncertain")return;linkStatus=status;linkReason=reason;linkSource=url;linkRetry=retry;};
  let privacyStatus:Check["status"]=d.applications.params.applicantField||a.agendaOnly?"pass":"uncertain",privacyReason=d.applications.params.applicantField||a.agendaOnly?"LAW resident text contains no captured individual identity or staff contacts. Official document contents are not reproduced.":"Applicant identity classification is not configured; privacy requires review.",privacySource=a.sourceUrl;
  const applicant=String(a.sourceFields[String(d.applications.params.applicantField??"")]??"");
  const person=individualApplicant(applicant)?applicant.split(/[,\s]+/).filter(w=>w.length>=2):[];
  const hasPerson=(text:string)=>person.length>0&&person.every(w=>new RegExp("(?:^|[^\\p{L}])"+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?=$|[^\\p{L}])","iu").test(text));
  const contact=/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|mailto:|\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b)/i;
  const residentText=a.residentialPrivacy?title:[title,a.description,a.address,a.name,d.recordLinks?.dataLabel??"",...attachments.map(a=>a.title)].join(" ");
  if(hasPerson(residentText)||contact.test(residentText)){privacyStatus="fail";privacyReason="LAW resident text exposes an individual applicant name or staff contact.";}
  if(!decision?.proposal?.hideDocuments)for(const attachment of attachments){
   const kind=attachmentKind(attachment.title,attachment.url),county=officialDocument(d,attachment.url)&&d.documents.countyAuthoredKinds?.includes(kind);
   if(a.residentialPrivacy||person.length&&!county&&["application","narrative","letter","public_comment","other"].includes(kind)){
    privacyStatus="fail";privacyReason=a.residentialPrivacy?"Residential documents are withheld; review or hide the record.":"An individual applicant's submitted or unclassified document is withheld pending review.";privacySource=attachment.url;
   }
  }
  for(const url of links){
   let u:URL;try{u=new URL(url);}catch{rejectLink("fail","Invalid resident URL.",url);continue;}
   if([...u.searchParams.values()].some(value=>hasPerson(value)||contact.test(value))){privacyStatus="fail";privacyReason="LAW link query exposes a personal name or staff contact.";privacySource=url;}
   const proof=await evidence(url);
   if(proof.status!==200){rejectLink(proof.status===0?"uncertain":"fail",proof.reason??"Case link has not returned HTTP 200.",url,proof.status===0);continue;}
   if(url===verify){if(!restrictedRecordData(d,url,proof.text,sourceRecordId(d,a)))rejectLink("fail",recordDataIssue(proof.text,sourceRecordId(d,a)),url);continue;}
   if(url===primary&&verify){
    if(url!==applicationRecordUrl(d,sourceRecordId(d,a),a.projectNumber))rejectLink("fail","JavaScript application URL does not match its configured full-record template.",url);
    continue;
   }
   if(/^(?:p?json)$/i.test(u.searchParams.get("f")??"")||/^\s*[\[{]/.test(proof.text)){rejectLink("fail","Resident raw-data link is not a configured restricted record query.",url);continue;}
   if(proof.readable===false){rejectLink("uncertain",proof.reason??"Could not read this document; retry on the next refresh. No owner action required.",url,true);continue;}
   const shared=ownItems.filter(({m,i})=>i.itemUrl===url||m.meetingPageUrl===url||i.attachments.some(f=>f.url===url)).flatMap(({i})=>i.caseNumbers.map(id=>projectNumber(d,id)??id));
   const identities=[...new Set([a.projectNumber??a.recordId,...shared])];
   if(!identities.some(id=>proof.text.includes(id))&&!filenameIdentifies(d,url,identities)&&!(a.residentialPrivacy&&url===d.participation.hearingsUrl))rejectLink("fail","Read source does not identify this project or either project on its shared agenda item.",url);
  }
  add("link-resolves-to-case",linkStatus,linkReason,linkSource);if(linkRetry)checks.at(-1)!.retry=true;
  const coverage=collectionCoverage(d,snapshot);
  add("location-in-boundary",!a.geometry?"pass":!coverage?"uncertain":coverageEligible(a,coverage)?"pass":"fail",!a.geometry?"Location not published; no map location is invented.":coverage?"Location checked against the jurisdiction coverage using the point/majority rule.":"Coverage boundary is unavailable.");
  const legacyVerified=!projectNumber(d,a.recordId)&&a.sourceRowCount===1&&String(a.sourceFields[(d.applications.params.fields as Record<string,string>)?.id])===a.recordId&&a.relatedCaseNumbers.every(id=>id===a.recordId||id.startsWith(a.recordId+"-"));
  const primaryProject=projectNumber(d,a.recordId);
  const identityValid=d.applications.params.projectKey?(primaryProject?[a.recordId,...a.relatedCaseNumbers].every(id=>projectNumber(d,id)===(a.projectNumber??primaryProject)):legacyVerified):!a.projectNumber||[a.recordId,...a.relatedCaseNumbers].every(id=>projectNumber(d,id)===a.projectNumber);
  const identityConflict=!!a.projectNumber&&[a.recordId,...a.relatedCaseNumbers].some(id=>projectNumber(d,id)&&projectNumber(d,id)!==a.projectNumber);
  add("case-identity",identityValid?"pass":identityConflict?"fail":"uncertain",identityValid?"Source APPFILE and case IDs identify this project.":identityConflict?"A case number belongs to another project.":"Legacy identity is not verified by a single exact APPFILE source row; review related case numbers.");
  add("privacy",decision?.action==="approve"&&privacyStatus==="uncertain"?"pass":privacyStatus,decision?.action==="approve"&&privacyStatus==="uncertain"?"Document privacy checked by the authenticated reviewer.":privacyReason,privacySource);
  const ai=(snapshot.aiSamples??[]).filter(s=>s.caseId===a.recordId);
  add("ai-labeled",ai.every(s=>!!s.sourceUrl&&Array.isArray(s.fields)&&(s.fields as {status?:string}[]).every(f=>["auto_published","approved","rejected"].includes(f.status??"")))?"pass":"uncertain",ai.length?"AI fields require citations and a recorded evidence status; resident components label AI summaries.":"No AI-generated text in this record.");
  const appearances=snapshot.meetings.filter(m=>m.items.some(i=>i.matchedApplications?.some(match=>match.recordId===a.recordId))),hearing=projectHearingState(d,appearances,createdAt);
  add("stage-and-date",appearances.every(m=>d.hearingBodies.some(b=>b.key===m.body))&&!hearing.next?.tentative?"pass":"uncertain","Published agenda body and jurisdiction timezone control the stage and next hearing.");
  const hard=checks.some(c=>["case-identity","privacy","link-resolves-to-case"].includes(c.check)&&c.status!=="pass");
  const publish=decision?.action!=="hide"&&(checks.every(c=>c.status==="pass")||decision?.action==="approve"&&!hard);
  records.push({recordId:a.recordId,sourceHash:hash,title,checks,publish,reviewer:decision?.reviewer,proposal:decision?.proposal,hidden:decision?.action==="hide"});
 }
 const unmatched=snapshot.meetings.filter(m=>!m.tentative).flatMap(m=>m.items.filter(i=>i.caseNumbers.length&&!i.caseNumbers.every(id=>snapshot.applications.some(a=>[a.recordId,...a.relatedCaseNumbers].includes(id)))).map(i=>({caseIds:i.caseNumbers,sourceUrl:i.itemUrl??m.meetingPageUrl,reason:"Agenda case has no retained project."})));
 let collectionReason="Complete collection; hearing-linked inventory retained.",complete=true;try{assertCollectionComplete(snapshot,options.previous);}catch(e){complete=false;collectionReason=(e as Error).message;}
 const coverage:Check[]=[{check:"hearing-items-accounted",status:unmatched.length?"fail":"pass",reason:unmatched.length?`${unmatched.length} agenda items need a project.`:"Every case-bearing agenda item has a project.",sourceUrl:d.participation.hearingsUrl??""},{check:"collection-complete",status:complete?"pass":"fail",reason:collectionReason,sourceUrl:String(d.agenda[0]?.params.baseUrl??"")},{check:"scope-explained",status:snapshot.collectionStats?.excludedByScope&&!snapshot.exclusions?"uncertain":"pass",reason:"Exclusions must be counted by category; hearing types, agenda items and organization development applications are in scope.",sourceUrl:String(d.applications.params.url??"")}];
 for(const id of d.selfCheck?.mustInclude??[])if(!snapshot.applications.some(a=>a.projectNumber===id||a.recordId===id))coverage.push({check:"must-include",status:"fail",reason:`Required project ${id} is absent.`,sourceUrl:String(d.applications.params.url??"")});
 const passRate=records.length?records.filter(r=>r.publish).length/records.length:0,goLive=passRate>=(d.selfCheck?.minPassRate??.95)&&coverage.every(c=>c.status==="pass"),counts:SelfCheckReport["counts"]={};
 for(const c of [...records.flatMap(r=>r.checks),...coverage]){counts[c.check]??={pass:0,fail:0,uncertain:0};counts[c.check][c.status]++;}
 const queue=records.filter(r=>!r.hidden).flatMap(r=>r.checks.filter(c=>c.status!=="pass"&&!c.retry&&!(r.publish&&r.reviewer)).map(check=>({recordId:r.recordId,sourceHash:r.sourceHash,check,proposal:r.proposal})));
 const total=snapshot.meetings.filter(m=>!m.tentative).flatMap(m=>m.items).filter(i=>i.caseNumbers.length).length;
 return {areaId:d.id,createdAt,snapshotHash:snapshotHash(snapshot),passRate,records,counts,coverage,agendaItems:{accounted:total-unmatched.length,total},unmatched,exclusions:snapshot.exclusions??{},queue,aiCostUsd:0,goLive:!!d.enabled&&goLive,decision:!d.enabled?"Disabled registry sample; report only.":goLive?"Automatic publication approved; Git preview remains preview until merge.":"Remain in review; no new records published."};
}
/** Distributable report contains identities and outcomes, never private source prose. */
export function redactSelfCheck(report:SelfCheckReport):SelfCheckReport{return {...report,records:report.records.map(r=>({...r,title:"[Resident title withheld]",proposal:undefined})),queue:report.queue.map(q=>({...q,proposal:undefined}))};}
export function selfCheckMarkdown(report:SelfCheckReport){return [`# ${report.areaId} self-check`,"",`As of ${report.createdAt}. Pass rate: ${(report.passRate*100).toFixed(2)}%. Queue: ${report.queue.length}. AI cost: $${report.aiCostUsd.toFixed(6)}.`,"",report.decision,"","| Check | Pass | Fail | Uncertain |","| --- | ---: | ---: | ---: |",...Object.entries(report.counts).map(([name,c])=>`| ${name} | ${c.pass} | ${c.fail} | ${c.uncertain} |`),"","## Coverage",...report.coverage.map(c=>`- ${c.check}: ${c.status}. ${c.reason}`),"","## Unmatched agenda items",...report.unmatched.map(i=>`- ${i.caseIds.join(", ")}: ${i.reason} [Source](${i.sourceUrl})`),"","## Exclusions",...Object.entries(report.exclusions).map(([category,count])=>`- ${category}: ${count}`),"","## Exceptions",...report.queue.map(q=>`- ${q.recordId}: ${q.check.check} — ${q.check.reason} [Source](${q.check.sourceUrl})`),""].join("\n");}
