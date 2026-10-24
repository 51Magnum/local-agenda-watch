import {withDbTransfer,currentDbTransfer} from "@/lib/db-transfer";
import { refreshConfiguredMaps } from "@/lib/maps/refresh";
import { discoverCaseDocuments } from "./discover";
import { ingestDocuments,digest } from "./ingest";
import { extractNativePdfPages } from "./extract";
import { checkpointRun,safeRunSummary,withRun } from "./telemetry";
import type { EvidenceStore } from "./store";
import type { IngestionRun } from "./types";
/** One durable run spans discovery OCR and extraction, including usage before a timeout. */
export async function refreshTimelines(store:EvidenceStore,{budgetMs=280000,discoverOnly=false,includeMaps=true}:{budgetMs?:number;discoverOnly?:boolean;includeMaps?:boolean}={}){
 const deadline=Date.now()+budgetMs;
 const run:IngestionRun={startedAt:new Date().toISOString(),checked:0,processed:0,skipped:0,errors:[],usage:[],hosts:[],areas:{}};
 await checkpointRun(store,run);
 return withDbTransfer(()=>withRun(store,run,async()=>{
  try{
   const maps=includeMaps?await refreshConfiguredMaps():undefined;
   const discovery=await discoverCaseDocuments({store,run,deadline:Math.min(deadline-60000,Date.now()+100000)});
   run.errors.push(...discovery.warnings);await checkpointRun(store,run);
   const documents=discoverOnly?discovery.documents.filter(d=>d.content!==undefined):discovery.documents;
   await ingestDocuments(store,documents,{run,budgetMs:Math.max(0,deadline-Date.now()),text:async bytes=>discovery.extractedPages.get(digest(bytes))??extractNativePdfPages(bytes)});
   return {run,maps,caseIds:discovery.caseIds};
  }catch(error){run.errors.push(error instanceof Error?error.message:"Timeline refresh failed");throw error;}
  finally{run.finishedAt=new Date().toISOString();await checkpointRun(store,run);await store.flush?.();const total=currentDbTransfer();run.transfer=store.metrics?{...store.metrics,...(total?{readBytes:total.readBytes,byStore:total.byStore}:{}),timelineReadBytes:store.metrics.readBytes}:undefined;await checkpointRun(store,run);await store.flush?.();console.info("[timeline:run]",JSON.stringify(safeRunSummary(run)));}
 }));
}
