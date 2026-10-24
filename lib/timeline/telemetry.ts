import { AsyncLocalStorage } from "node:async_hooks";
import type { EvidenceStore } from "./store";
import type { IngestionRun, HostCheck } from "./types";
const context = new AsyncLocalStorage<{store:EvidenceStore;run:IngestionRun;areaId?:string;documentId?:string}>();
export function withRun<T>(store:EvidenceStore,run:IngestionRun,work:()=>Promise<T>){return context.run({store,run},work);}
export function withDocument<T>(areaId:string,documentId:string,work:()=>Promise<T>){const c=context.getStore();return c?context.run({...c,areaId,documentId},work):work();}
export async function checkpointRun(store:EvidenceStore,run:IngestionRun){await store.mutate(s=>{const i=s.runs.findIndex(r=>r.startedAt===run.startedAt);if(i>=0)s.runs[i]=structuredClone(run);else s.runs=[...s.runs.slice(-49),structuredClone(run)];});}
export async function recordUsage(operation:string,usage?:{input_tokens?:number;output_tokens?:number;total_tokens?:number}){
 const c=context.getStore();if(!c)return;
 const count=(n:unknown)=>typeof n==="number"&&Number.isFinite(n)?Math.max(0,n):0;
 const inputTokens=count(usage?.input_tokens),outputTokens=count(usage?.output_tokens);
 (c.run.usage??=[]).push({at:new Date().toISOString(),areaId:c.areaId??"discovery",documentId:c.documentId,operation,inputTokens,outputTokens,totalTokens:count(usage?.total_tokens)||inputTokens+outputTokens});
 await checkpointRun(c.store,c.run);
}
export function recordHost(areaId:string,url:string,outcome:HostCheck["outcome"],detail?:string){
 const c=context.getStore();if(!c)return;
 let host:string;try{host=new URL(url).hostname;}catch{return;}
 const entry={areaId,host,outcome,detail};
 if(!(c.run.hosts??=[]).some(h=>h.areaId===areaId&&h.host===host&&h.outcome===outcome&&h.detail===detail))c.run.hosts.push(entry);
 console.info("[timeline:host]",areaId,host,outcome,detail??"");
}

export function currentRun(){return context.getStore()?.run;}
export function hostWasBlocked(areaId:string,url:string){const host=new URL(url).hostname;return Boolean(context.getStore()?.run.hosts?.some(h=>h.areaId===areaId&&h.host===host&&h.outcome==="blocked"));}

/** Aggregate diagnostics contain no credentials, addresses, quotes, or resident information. */
export function safeRunSummary(run:IngestionRun){return {startedAt:run.startedAt,finishedAt:run.finishedAt,areas:run.areas,hosts:run.hosts,checked:run.checked,processed:run.processed,errors:run.errors.length,tokens:{calls:run.usage?.length??0,input:run.usage?.reduce((n,u)=>n+u.inputTokens,0)??0,output:run.usage?.reduce((n,u)=>n+u.outputTokens,0)??0,total:run.usage?.reduce((n,u)=>n+u.totalTokens,0)??0}};}
