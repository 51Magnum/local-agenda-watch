import {expect,it} from "vitest";
import {applicantNeedsReview} from "../applicant-privacy";
import {emptyEvidenceState,publicFields,EXTRACTED_KEYS,type EvidenceField} from "./types";
import type {Extraction} from "./extract";
import {reconcileFields} from "./verification";
import {ingestDocuments} from "./ingest";
import {reviewField} from "./review";
it.each(["Jane Smith","Smith, Jane","John & Jane Smith","UnrecognizedName"])("requires review for individual or uncertain applicant %s",value=>expect(applicantNeedsReview(value)).toBe(true));
it.each(["Example LLC","Example Homes Inc","Smith Family Trust","Ada County"])("allows explicitly identified organization %s",value=>expect(applicantNeedsReview(value)).toBe(false));
it("withholds legacy auto-published private applicants immediately and reconciles them to pending",()=>{
 const state=emptyEvidenceState();state.documents.doc={id:"doc",url:"https://official.test",title:"Official report",hash:"hash",caseIds:["CASE"],kind:"staff-report",pages:[],state:"complete",checkedAt:""};
 const f:EvidenceField={id:"f",documentId:"doc",documentHash:"hash",caseId:"CASE",key:"applicantCompany",value:"Jane Smith",quote:"Jane Smith applied",page:1,sourceKind:"staff-report",sourceUrl:"https://official.test",confidence:1,status:"auto_published",createdAt:""};state.fields.f=f;
 expect(publicFields(state,["CASE"])).toEqual([]);reconcileFields(state);expect(state.fields.f.status).toBe("pending");
});
it("requires actual review for a private applicant even on a structured official source",async()=>{
 const state=emptyEvidenceState(),store={read:async()=>structuredClone(state),mutate:async<T,>(update:(s:typeof state)=>T)=>update(state)};
 await ingestDocuments(store,[{areaId:"ada-county",url:"https://apps.adacounty.id.gov/AdaFileBrowse/source",title:"Official application",kind:"case-record",caseIds:["202601398-CU"],content:"Jane Smith applied",fields:[{key:"applicantCompany",value:"Jane Smith",quote:"Jane Smith applied",page:null}]}]);
 const field=Object.values(state.fields)[0];expect(field.status).toBe("pending");expect(publicFields(state,[field.caseId],"ada-county")).toEqual([]);
 await reviewField(store,{id:field.id,action:"approve",note:"Owner reviewed this identity"});expect(publicFields(state,[field.caseId],"ada-county")).toHaveLength(1);
});
it("keeps a high-confidence AI applicant candidate pending despite the ordinary prose auto-publication path",async()=>{
 const state=emptyEvidenceState(),store={read:async()=>structuredClone(state),mutate:async<T,>(update:(s:typeof state)=>T)=>update(state)},quote="Jane Smith applied for this project.";
 const candidate=Object.fromEntries(EXTRACTED_KEYS.map(k=>[k,{value:null,page:null,quote:null,confidence:0}])) as Extraction;candidate.applicantCompany={value:"Jane Smith",page:1,quote,confidence:1};
 await ingestDocuments(store,[{areaId:"ada-county",url:"https://apps.adacounty.id.gov/AdaFileBrowse/report.pdf",title:"Official staff report",kind:"staff-report",caseIds:["202601398-CU"]}],{download:async()=>new Uint8Array([1]),text:async()=>[{page:1,text:quote,method:"native"}],ocr:async(_b,p)=>p,extract:async()=>candidate});
 expect(Object.values(state.fields)[0].status).toBe("pending");expect(publicFields(state,["202601398-CU"],"ada-county")).toEqual([]);
});
