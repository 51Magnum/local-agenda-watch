import {withDbTransfer,currentDbTransfer} from "@/lib/db-transfer";
import { refreshConfiguredMaps } from "@/lib/maps/refresh";
import { discoverCaseDocuments } from "./discover";
import { ingestDocuments,digest,documentId } from "./ingest";
import { EXTRACTION_VERSION, extractNativePdfPages } from "./extract";
import { checkpointRun,safeRunSummary,withRun } from "./telemetry";
import type { EvidenceStore } from "./store";
import type { IngestionRun } from "./types";
import type {SchedulePlan} from "./schedule";
import { refreshHearingMeetings } from "../hearings/refresh";
/** One durable run spans discovery OCR and extraction, including usage before a timeout. */
export async function refreshTimelines(store:EvidenceStore,{budgetMs=280000,discoverOnly=false,includeMaps=true,plan,meetingDatesByArea}:{budgetMs?:number;discoverOnly?:boolean;includeMaps?:boolean;plan?:SchedulePlan;meetingDatesByArea?:Record<string,string[]>}={}){
 const deadline=Date.now()+budgetMs;
 const run:IngestionRun={modes:plan?.modes,startedAt:new Date().toISOString(),checked:0,processed:0,skipped:0,errors:[],usage:[],hosts:[],areas:{}};
 const checkedCases:Record<string,string[]>={};
 await checkpointRun(store,run);
 return withDbTransfer(()=>withRun(store,run,async()=>{
  try{
   const maps=includeMaps?await refreshConfiguredMaps():undefined;
   const discovery=await discoverCaseDocuments({store,run,caseIdsByArea:plan?.caseIdsByArea,meetingDatesByArea,deadline:Math.min(deadline-60000,Date.now()+100000)});
   try{await refreshHearingMeetings(discovery.feeds,{deadline:Math.min(deadline-45000,Date.now()+45000)});}catch{run.errors.push("Upcoming meeting-link storage unavailable; existing links retained.");}
   run.errors.push(...discovery.warnings);await checkpointRun(store,run);
   let documents=discoverOnly?discovery.documents.filter(d=>d.content!==undefined):discovery.documents;
   if(plan?.modes.includes("daily-sweep")){
    const state=await store.read();
    // Daily discovery notices new files; only due hearings re-download already completed PDFs.
    documents=documents.filter(d=>d.kind==="case-record"||state.documents[documentId(d)]?.state!=="complete"||state.documents[documentId(d)]?.extractionVersion!==EXTRACTION_VERSION||d.caseIds.some(id=>plan.recheckCaseIdsByArea[d.areaId??"nampa"]?.includes(id)));
   }
   if(plan?.modes.length===1&&plan.modes[0]==="pre-hearing")documents=documents.filter(d=>d.kind==="agenda"||d.kind==="staff-report");
   await ingestDocuments(store,documents,{run,budgetMs:Math.max(0,deadline-Date.now()),onChecked:d=>{const ids=checkedCases[d.areaId??"nampa"]??=[];for(const id of d.caseIds)if(!ids.includes(id))ids.push(id);},text:async bytes=>discovery.extractedPages.get(digest(bytes))??extractNativePdfPages(bytes)});
   return {run,maps,caseIds:discovery.caseIds,feeds:discovery.feeds,checkedCases};
  }catch(error){run.errors.push(error instanceof Error?error.message:"Timeline refresh failed");throw error;}
  finally{run.finishedAt=new Date().toISOString();await checkpointRun(store,run);await store.flush?.();const total=currentDbTransfer();run.transfer=store.metrics?{...store.metrics,...(total?{readBytes:total.readBytes+Math.max(0,store.metrics.readBytes-(total.byStore.timeline??0)),byStore:{...total.byStore,timeline:store.metrics.readBytes}}:{}),timelineReadBytes:store.metrics.readBytes}:undefined;await checkpointRun(store,run);await store.flush?.();console.info("[timeline:run]",JSON.stringify(safeRunSummary(run)));}
 }));
}
