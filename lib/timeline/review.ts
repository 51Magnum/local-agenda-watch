import { randomUUID } from "node:crypto";
import { DECISION_KEYS, type EvidenceField, type EvidenceState, type AuditEntry } from "./types";
import { passing } from "./verification";
import type { EvidenceStore } from "./store";
export type ReviewInput={id:string;action:"approve"|"reject";value?:string;note?:string;expectedReviewedAt?:string;expectedValue?:string};
function validate(state:EvidenceState,input:ReviewInput){
 const field=state.fields[input.id];if(!field)throw new Error("Field not found");
 const document=state.documents[field.documentId];
 if(!document||document.hash!==field.documentHash||document.state!=="complete")throw new Error("Source document changed or is incomplete; review the latest version");
 if(input.expectedReviewedAt!==undefined && (field.reviewedAt??"")!==input.expectedReviewedAt)throw new Error("Another reviewer changed this field; refresh before reviewing");
 if(input.expectedValue!==undefined && field.value!==input.expectedValue)throw new Error("Field changed; refresh before reviewing");
 const value=input.value?.trim()??field.value;
 if(input.action==="approve"){
  if(!value||value.length>4000)throw new Error("A value of 1–4000 characters is required");
  if(/Date$/.test(field.key)&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error("Use a date in YYYY-MM-DD format");
  if(field.key==="pzResult"&&!["recommend approval","recommend denial","continued"].includes(value))throw new Error("Choose recommend approval, recommend denial, or continued");
  if(field.key==="councilDecision"&&!["approved","denied","continued","withdrawn"].includes(value))throw new Error("Choose approved, denied, continued, or withdrawn");
  if(/Speakers/.test(field.key)&&!/^\d+$/.test(value))throw new Error("Use a whole-number speaker count");
 }
 return {field,value};
}
export async function reviewBatch(store:EvidenceStore,inputs:ReviewInput[],onlyPassing=false){
 if(!inputs.length||inputs.length>500||new Set(inputs.map(i=>i.id)).size!==inputs.length)throw new Error("Select 1–500 distinct fields");
 const batchId=randomUUID(),at=new Date().toISOString();
 const fields=await store.mutate(state=>{
  const entries=inputs.map(input=>({...validate(state,input),input}));
  if(onlyPassing&&entries.some(({field,value})=>!passing(field)||value!==field.value))throw new Error("Passing-check batches require unchanged values with all checks passed");
  for(const {field,value,input}of entries){
   const previousValue=field.value;
   const audit:AuditEntry={fieldId:field.id,key:field.key,areaId:field.areaId,at,batchId,previousStatus:field.status,previousReviewedAt:field.reviewedAt,previousOriginalValue:field.originalValue,previousValue,value:input.action==="reject"?previousValue:value,action:input.action==="reject"?"reject":value===previousValue?"approve":"edit",note:input.note?.slice(0,2000)??""};
   if(input.action==="approve"){field.originalValue??=previousValue;field.value=value;field.status="approved";}else field.status="rejected";
   field.reviewedAt=at;state.audit.push(audit);
  }
  return entries.map(e=>e.field);
 });return {batchId,at,fields};
}
export async function reviewField(store:EvidenceStore,input:ReviewInput){return (await reviewBatch(store,[input])).fields[0];}
export async function undoBatch(store:EvidenceStore,batchId:string,now=Date.now()){
 return store.mutate(state=>{
  const entries=state.audit.filter(a=>a.batchId===batchId&&a.action!=="undo");
  if(!entries.length||now-Date.parse(entries[0].at)>10000||state.audit.some(a=>a.batchId===batchId&&a.action==="undo"))throw new Error("Undo expired or already used");
  for(const a of entries){const f=state.fields[a.fieldId],d=f&&state.documents[f.documentId];if(!f||f.reviewedAt!==a.at||!d||d.hash!==f.documentHash||d.state!=="complete")throw new Error("Field or document changed; undo is no longer available");}
  for(const a of entries){const f=state.fields[a.fieldId];f.value=a.previousValue;f.status=a.previousStatus??"pending";f.reviewedAt=a.previousReviewedAt;f.originalValue=a.previousOriginalValue;state.audit.push({...a,at:new Date(now).toISOString(),action:"undo",previousValue:a.value,value:a.previousValue,note:"Review undone"});}
  return entries.map(a=>state.fields[a.fieldId]);
 });
}
export function accuracyStats(state:EvidenceState){
 const undone=new Set(state.audit.filter(a=>a.action==="undo").map(a=>a.batchId));
 const groups=new Map<string,{reviews:number;correct:number}>();
 const reviewed=new Map<string,{key:string;correct:boolean}>();
 for(const a of state.audit){if(a.action==="undo"||undone.has(a.batchId))continue;const key=a.key??state.fields[a.fieldId]?.key;if(!key)continue;const prior=reviewed.get(a.fieldId);reviewed.set(a.fieldId,{key,correct:(prior?.correct??true)&&a.action==="approve"});}
 for(const {key,correct}of reviewed.values()){const g=groups.get(key)??{reviews:0,correct:0};g.reviews++;if(correct)g.correct++;groups.set(key,g);}
 return [...groups].map(([key,g])=>({key,...g,accuracy:g.correct/g.reviews,suggest:g.reviews>=50&&g.correct/g.reviews>=.98}));
}
export function needsDecisionApproval(field:EvidenceField){return DECISION_KEYS.has(field.key);}
