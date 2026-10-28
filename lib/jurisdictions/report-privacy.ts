import type {QaReport} from "./store";
/** Distributed QA artifacts carry counts/provenance, never candidate prose or rosters. */
export function redactQaReport(report:QaReport):QaReport{
 const samples=Array.isArray(report.data.aiSamples)?report.data.aiSamples:[];
 return {...report,data:{...report.data,redactionPolicy:"AI candidate text is withheld from distributable reports; review source-backed candidates in authenticated admin.",aiSamples:samples.map(sample=>({caseId:sample.caseId,hash:sample.hash,sourceUrl:sample.sourceUrl,pageCount:sample.pageCount,costUsd:sample.costUsd,tokens:sample.tokens,fields:Array.isArray(sample.fields)?sample.fields.map((field:Record<string,unknown>)=>({key:field.key,value:"[Candidate text withheld; review in authenticated admin]",page:field.page,status:field.status,sourceUrl:field.sourceUrl})):[]}))}};
}
