import { expect, it, vi } from "vitest";
import { emptyEvidenceState, EXTRACTED_KEYS, publicFields, type EvidenceField, type StoredDocument } from "./types";
import { bodyLabel, caseMatchesQuote, canAutoApprove, correctedKey, countSpeakers, reconcileFields, verifyCandidate } from "./verification";
import { accuracyStats, reviewBatch, undoBatch } from "./review";
import { ingestDocuments } from "./ingest";
import { validateExtraction, type Extraction } from "./extract";
const neutral="Daphne Sosa spoke neutrally on the application.";
const opposed="There were no members of the public in attendance at the hearing opposing the project.";
const text="DA-26-03 "+neutral+" "+opposed+" Council approved by a vote of 5-0. Preserve the 3 existing trees as much as possible.";
const doc:StoredDocument={id:"d",hash:"h",caseIds:["DA-26-03"],areaId:"star",url:"https://www.staridaho.org/test.pdf",title:"City Council minutes — 2026-09-01",kind:"minutes",meeting:{body:"City Council",date:"2026-09-01",isHearing:true},pages:[{page:2,text,method:"native"}],state:"complete",checkedAt:""};
const field=(key:EvidenceField["key"],value:string,quote=neutral,id=key as string):EvidenceField=>({id,documentId:"d",documentHash:"h",caseId:"DA-26-03",key,value,quote,page:2,confidence:.98,sourceKind:"minutes",sourceUrl:doc.url,status:"pending",createdAt:""});
const roster=[{name:"Daphne Sosa",position:"neutral" as const,quote:neutral,page:2}];
function fixture(){const state=emptyEvidenceState();state.documents.d=structuredClone(doc);return {state,store:{read:async()=>structuredClone(state),mutate:async<T,>(f:(s:typeof state)=>T)=>f(state)}};}
it("relabels DA-26-03 legacy Council conditions and counts, moves Daphne to neutral and removes support",()=>{
 const {state}=fixture();for(const f of [field("pzConditions","Preserve trees","Preserve the 3 existing trees as much as possible."),field("pzSpeakersFor","1"),field("pzSpeakersAgainst","0",opposed)])state.fields[f.id]=f;
 reconcileFields(state);expect(Object.values(state.fields).every(f=>f.body==="City Council"&&f.key.startsWith("council"))).toBe(true);
 expect(state.fields.pzSpeakersFor).toMatchObject({key:"councilSpeakersFor",value:"0",status:"pending"});
 expect(state.fields["pzSpeakersFor-neutral"]).toMatchObject({key:"councilSpeakersNeutral",value:"1"});
 expect(reconcileFields(state)).toBe(0);
});
it("checks body including Board, exact quote and neutral counts",()=>{
 expect(verifyCandidate(field("pzSpeakersFor","1"),doc,doc.pages).reasons).toContain("body mismatch");
 expect(correctedKey("pzConditions",{...doc,meeting:{...doc.meeting!,body:"Board of County Commissioners"}})).toBe("councilConditions");
 expect(bodyLabel({...doc,meeting:{...doc.meeting!,body:"Board of County Commissioners"}})).toBe("Board of County Commissioners");
 const f=field("councilSpeakersFor","0");f.verification=verifyCandidate(f,doc,doc.pages,{speakers:roster,complete:true,secondPass:true});expect(canAutoApprove(f)).toBe(true);
 expect(countSpeakers(roster,"support")).toBe(0);expect(countSpeakers([...roster,...roster],"neutral")).toBe(1);
 expect(verifyCandidate({...f,quote:"Daphne Sosa supported the application."},doc,doc.pages).reasons).toContain("quote not found");
 expect(verifyCandidate({...f,value:"1"},doc,doc.pages,{speakers:[{...roster[0],position:"support"}],complete:true,secondPass:true}).value).toBe(false);
 expect(verifyCandidate(field("councilSpeakersAgainst","0",opposed),doc,doc.pages,{secondPass:true}).value).toBe(true);
});
it("auto-publishes only verified low-stakes fields; decisions and disagreeing passes remain pending",async()=>{
 const {state,store}=fixture();delete state.documents.d;
 const blank=Object.fromEntries(EXTRACTED_KEYS.map(k=>[k,{value:null,quote:null,page:null,confidence:0}])) as Extraction;
 const counts={value:"99",quote:neutral,page:2,confidence:.91,speakers:roster,complete:true};
 const extraction={...blank,councilSpeakersFor:counts,councilSpeakersNeutral:counts,councilDecision:{value:"approved",quote:"Council approved by a vote of 5-0.",page:2,confidence:1}};
 const second={councilSpeakersFor:{...counts,value:"0"},councilSpeakersNeutral:{...counts,value:"1"},councilDecision:extraction.councilDecision};
 const source={...doc,areaId:"nampa",url:"https://www.cityofnampa.us/DocumentCenter/View/1/test.pdf"};
 await ingestDocuments(store,[source],{download:async()=>new Uint8Array([1]),text:async()=>doc.pages,extract:async()=>extraction,secondPass:async()=>second});
 expect(Object.values(state.fields).find(f=>f.key==="councilSpeakersFor")).toMatchObject({value:"0",status:"auto_published"});
 expect(Object.values(state.fields).find(f=>f.key==="councilSpeakersNeutral")).toMatchObject({value:"1",status:"auto_published"});
 expect(Object.values(state.fields).find(f=>f.key==="councilDecision")).toMatchObject({status:"pending"});
 expect(publicFields(state,doc.caseIds).map(f=>f.key)).toEqual(["councilSpeakersFor","councilSpeakersNeutral"]);
 const decision=field("councilDecision","approved","Council approved by a vote of 5-0.");decision.verification=verifyCandidate(decision,doc,doc.pages,{secondPass:true});expect(canAutoApprove(decision)).toBe(false);
 decision.key="councilConditions";decision.verification.secondPass=false;expect(canAutoApprove(decision)).toBe(false);
});
it("keeps nonexistent quote candidates pending for visible review instead of silently discarding them",()=>{
 const blank=Object.fromEntries(EXTRACTED_KEYS.map(k=>[k,{value:null,quote:null,page:null,confidence:0}])) as Extraction;
 const warnings:string[]=[];const result=validateExtraction({...blank,councilConditions:{value:"Trees",quote:"Invented condition text",page:2,confidence:.99}},doc.pages,{warnings,retainFlagged:true});
 expect(result.councilConditions.value).toBe("Trees");expect(warnings[0]).toContain("Source quote not found");
});
it("reviews five of 25 atomically with edited values, then undoes all five within ten seconds",async()=>{
 const {state,store}=fixture();for(let i=0;i<25;i++)state.fields["f"+i]=field("councilConditions","Original",text,"f"+i);
 const inputs=Array.from({length:5},(_,i)=>({id:"f"+i,action:"approve" as const,value:i===0?"Edited value":"Original",expectedValue:"Original",expectedReviewedAt:""}));
 const result=await reviewBatch(store,inputs);expect(state.fields.f0.value).toBe("Edited value");expect(Object.values(state.fields).filter(f=>f.status==="pending")).toHaveLength(20);
 expect(state.audit.filter(a=>a.action==="edit")).toHaveLength(1);
 await undoBatch(store,result.batchId,Date.parse(result.at)+9000);expect(Object.values(state.fields).filter(f=>f.status==="pending")).toHaveLength(25);expect(state.fields.f0.value).toBe("Original");expect(accuracyStats(state)).toEqual([]);
 await expect(undoBatch(store,result.batchId)).rejects.toThrow("already used");
 const second=await reviewBatch(store,[inputs[0]]);await expect(undoBatch(store,second.batchId,Date.parse(second.at)+10001)).rejects.toThrow("expired");
 await expect(reviewBatch(store,[{id:"f1",action:"approve"},{id:"missing",action:"reject"}])).rejects.toThrow("Field not found");expect(state.fields.f1.status).toBe("pending");
});
it("rejects stale reviews and passing-only edits; measures unique field accuracy without duplicate inflation",async()=>{
 const {state,store}=fixture();for(let i=0;i<50;i++)state.fields["f"+i]=field("councilConditions","Original",text,"f"+i);
 await expect(reviewBatch(store,[{id:"f0",action:"approve",value:"Edited"}],true)).rejects.toThrow("Passing-check");
 await reviewBatch(store,Object.values(state.fields).map(f=>({id:f.id,action:"approve",value:f.id==="f0"?"Edited":"Original"})));
 await expect(reviewBatch(store,[{id:"f1",action:"reject",expectedReviewedAt:""}])).rejects.toThrow("Another reviewer");
 await reviewBatch(store,[{id:"f0",action:"approve"}]);expect(accuracyStats(state)[0]).toMatchObject({reviews:50,correct:49,accuracy:.98,suggest:true});
});

it("withholds DA-26-03 facts quoted from the State & Main hearing even on the same Council minutes page",()=>{
 const d={...doc,caseIds:["CU-24-07","DA-26-03"],caseContexts:[{caseIds:["CU-24-07"],title:"State & Main Streets Multiple Use Development Conditional Use Permit (CU-24-07)"},{caseIds:["DA-26-03"],title:"Mike Jackson 21577 Bent Lane Annexation & Zoning and Development Agreement"}]};
 const pages=[{page:2,text:"State & Main Streets Multiple Use Development Conditional Use Permit "+neutral,method:"native" as const},{page:3,text:"Preserve trees. Mike Jackson 21577 Bent Lane Annexation & Zoning and Development Agreement. The motion carried.",method:"native" as const}];
 expect(caseMatchesQuote(field("councilSpeakersNeutral","1"),d,pages)).toBe(false);
 expect(caseMatchesQuote({...field("councilSpeakersNeutral","1"),caseId:"CU-24-07"},d,pages)).toBe(true);
});
