import type {IngestionRun,StoredDocument} from "./types";
export function tokenTotals(run:IngestionRun){return run.tokenTotals??{calls:run.usage?.length??0,input:run.usage?.reduce((n,u)=>n+u.inputTokens,0)??0,output:run.usage?.reduce((n,u)=>n+u.outputTokens,0)??0,total:run.usage?.reduce((n,u)=>n+u.totalTokens,0)??0};}
export function compactRun(run:IngestionRun):IngestionRun{const result={...run,tokenTotals:tokenTotals(run),errors:run.errors.slice(0,20)};delete result.usage;return result;}
export function documentMetadata(doc:StoredDocument){const result={...doc,structured:doc.structured??doc.content!==undefined,pageCount:doc.pages.length||doc.pageCount||0};delete result.content;return {...result,pages:undefined};}
