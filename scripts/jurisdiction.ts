import {buildQaReport} from "../lib/jurisdictions/qa-builder";
import {launchMetrics} from "../lib/jurisdictions/launch-metrics";
import {mkdir,writeFile} from "node:fs/promises";
import {jurisdiction,ingestionJurisdictions,publicJurisdictions} from "../lib/jurisdictions/registry";
import {validateEndpoints,sampleAi,qaReport,reportMarkdown} from "../lib/jurisdictions/onboarding";
import {collectJurisdiction} from "../lib/jurisdictions/collect";

import {runSelfCheck} from "../lib/jurisdictions/run-self-check";
import {checkFixtures} from "../lib/jurisdictions/fixture-check";
import {requireOnboardingMutation} from "../lib/runtime-environment";
async function main(){
 const [command,id,...args]=process.argv.slice(2),value=(flag:string,defaultValue:string)=>{const index=args.indexOf(flag);return index<0?defaultValue:args[index+1]??defaultValue;};
 if(command==="list"){console.log(([id,...args].includes("--public")?publicJurisdictions():ingestionJurisdictions()).map(d=>d.id).join("\n"));return;}
 const d=jurisdiction(id);if(!d)throw Error("Unknown jurisdiction "+id);
 if(args.includes("--write")||command==="check"&&!args.includes("--dry-run")&&!args.includes("--fixtures"))requireOnboardingMutation();
 switch(command){
  case"check":{const snapshot=args.includes("--collect")?await collectJurisdiction(id):undefined;const report=args.includes("--fixtures")?await checkFixtures(id):await runSelfCheck(id,{snapshot,dryRun:args.includes("--dry-run")});console.log(JSON.stringify({passRate:report.passRate,coverage:report.coverage,queue:report.queue.length,goLive:report.goLive,aiCostUsd:report.aiCostUsd},null,2));break;}
  case"validate":console.log(JSON.stringify(await validateEndpoints(id),null,2));break;
  case"backfill":{if(args.includes("--write")&&args.includes("--report"))throw Error("--report on backfill requires a read-only dry-run");if(args.includes("--write")&&args.includes("--dry-run"))throw Error("Choose --write or --dry-run");const snapshot=await collectJurisdiction(id,{days:Number(value("--days","90")),write:args.includes("--write")});if(args.includes("--report")){if(args.includes("--write"))throw Error("--report on backfill is for read-only dry-runs; use qa-report for durable staging");const report=buildQaReport(d,snapshot,[],{dryRun:true,budgetLedgerAvailable:false}),dir="reports/jurisdictions",base=dir+"/"+id+"-"+report.createdAt.slice(0,10)+"-dry-run";await mkdir(dir,{recursive:true});await writeFile(base+".json",JSON.stringify(report,null,2)+"\n");await writeFile(base+".md",reportMarkdown(report));}
 console.log(JSON.stringify({areaId:id,...launchMetrics(snapshot),write:args.includes("--write"),applications:snapshot.applications.length,meetings:snapshot.meetings.length,items:snapshot.meetings.reduce((n,m)=>n+m.items.length,0),complete:snapshot.complete,health:snapshot.health,skipped:snapshot.skipped},null,2));break;}
  case"sample-ai":console.log(JSON.stringify(await sampleAi(id,{n:Number(value("--n","5")),maxUsd:Number(value("--max-usd","1"))}),null,2));break;
  case"qa-report":{const report=await qaReport(id),dir="reports/jurisdictions";await mkdir(dir,{recursive:true});const base=dir+"/"+id+"-"+report.createdAt.slice(0,10);await writeFile(base+".json",JSON.stringify(report,null,2));await writeFile(base+".md",reportMarkdown(report));console.log(JSON.stringify({report:base,passed:report.passed,checks:report.checks}));break;}
  case"promote":throw Error("Manual config promotion is retired; run check to record automatic database publication");
  default:throw Error("Commands: list, validate, backfill, sample-ai, qa-report, promote");
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
