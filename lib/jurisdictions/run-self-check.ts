import {mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {selfCheck,redactSelfCheck,selfCheckMarkdown,type LinkEvidence} from "./self-check";
import {exceptionDecisions,persistSelfCheck} from "./self-check-store";
import {jurisdiction} from "./registry";
import {readStaging,type StagingSnapshot} from "./store";
import {sourceHttp} from "./collect";
import {SourceFailure} from "./http";
import {proposeFix} from "./ai-fixer";
import {verifiedProposal} from "./self-check";
import {withRun} from "../timeline/telemetry";
import {getEvidenceStore} from "../timeline/store";
export async function runSelfCheck(areaId:string,options:{dryRun?:boolean;snapshot?:StagingSnapshot;previous?:StagingSnapshot;links?:(url:string)=>Promise<LinkEvidence>;reports?:boolean}={}){
 const d=jurisdiction(areaId),snapshot=options.snapshot??await readStaging(areaId);if(!d||!snapshot)throw Error("Collect a staging snapshot before checking");
 const http=sourceHttp(areaId),deadline=Date.now()+180000;
 const links=options.links??(async(url:string)=>{
  if(Date.now()>deadline)throw Error("Source verification deferred to next refresh");
  const data=await http.request(url);let text=new TextDecoder().decode(data.bytes),documentHash:string|undefined;
  if(text.startsWith("%PDF")){
   documentHash=createHash("sha256").update(data.bytes).digest("hex");
   const {extractText,definePDFJSModule}=await import("unpdf");await definePDFJSModule(()=>import("pdfjs-dist/legacy/build/pdf.mjs"));
   const result=await extractText(data.bytes,{mergePages:true});text=result.text;
  }
  return {status:data.health.status===304?200:data.health.status??0,text,documentHash};
 });
 const cached=new Map<string,Promise<LinkEvidence>>(),proof=(url:string)=>{if(!cached.has(url))cached.set(url,links(url).catch(e=>({status:e instanceof SourceFailure?e.health.status??0:0,text:"",reason:e instanceof SourceFailure&&e.health.state==="blocked"?"Official source access is blocked; no access challenge was bypassed.":Date.now()>deadline?"Source verification deferred: this run's time limit was reached.":"Official source could not be verified; retry on the next refresh."})));return cached.get(url)!;};
 const decisions=await exceptionDecisions(areaId);
 let report=await selfCheck(d,snapshot,{links:proof,previous:options.previous,decisions});
 // Development and dry runs never invoke a paid model. Production uses the existing
 // dual-ledger reservation path, bounded to three exceptional records per refresh.
 if(!options.dryRun&&process.env.VERCEL_ENV==="production"&&process.env.OPENAI_API_KEY){
  const run:import("../timeline/types").IngestionRun={startedAt:new Date().toISOString(),checked:0,processed:0,skipped:0,errors:[]};
  const proposals=new Map<string,import("./self-check").Proposal>();
  await withRun(getEvidenceStore(),run,async()=>{
   for(const recordId of [...new Set(report.queue.filter(q=>["title-from-source","privacy"].includes(q.check.check)).map(q=>q.recordId))].slice(0,3)){
    if(Date.now()>deadline)break;const app=snapshot.applications.find(a=>a.recordId===recordId)!,result=await proposeFix(areaId,app);
    if(result.proposal){proposals.set(recordId,result.proposal);if(result.autoApply&&verifiedProposal(app,result.proposal,d.selfCheck?.typeOrder))decisions.push({areaId,recordId,sourceHash:report.records.find(r=>r.recordId===recordId)!.sourceHash,action:"fix",reviewer:"self-check",proposal:result.proposal});}
   }
  });
  report=await selfCheck(d,snapshot,{links:proof,previous:options.previous,decisions});report.aiCostUsd=run.costUsd??0;
  for(const r of report.records)r.proposal??=proposals.get(r.recordId);
  for(const q of report.queue)q.proposal??=proposals.get(q.recordId);
 }
 if(!options.dryRun){await persistSelfCheck(snapshot,report);
  if(process.env.VERCEL_ENV==="production"){
   await(await import("../areas/registry")).visibleAreas();
   const published=await(await import("./self-check-store")).readPublished(areaId);
   if(published)await(await import("../maps/store")).saveMapSnapshot((await import("./resident-records")).stagedMapSnapshot(d,published));
  }
  if(!report.goLive&&process.env.VERCEL_ENV==="production"){
   try{await(await import("../email/jobs")).queueCorrectionReceived({id:"self-check-"+areaId+"-"+report.snapshotHash,project:areaId,message:`Jurisdiction self-check needs attention: ${(report.passRate*100).toFixed(2)}% pass; ${report.queue.length} exceptions. No new records are being published. Review /admin/review.`,email:null});}catch{console.error("[self-check] Internal alert queue unavailable; exceptions remain in /admin/review");}
  }
 }
 if(options.reports!==false){const base=`reports/jurisdictions/${areaId}-selfcheck-${report.createdAt.slice(0,10)}`;await mkdir("reports/jurisdictions",{recursive:true});await writeFile(base+".json",JSON.stringify(redactSelfCheck(report),null,2)+"\n");await writeFile(base+".md",selfCheckMarkdown(report));}
 return report;
}
