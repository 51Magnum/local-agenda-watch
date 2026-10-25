import {seedImageQueue,processImageQueue} from "../lib/maps/image-worker";
import {rescanCase} from "../lib/maps/image-job-store";
import {getJurisdiction} from "../lib/maps/jurisdictions";
/** CLI uses the same one-case queue as cron; it never rewrites a full map snapshot. */
async function main(){
 const argument=process.argv[2];let target:{areaId:string;caseId:string}|undefined;
 if(argument){const [areaId,caseId]=argument.includes(":")?argument.split(":"):["nampa",argument];if(!getJurisdiction(areaId)||!caseId)throw new Error("Use area:caseId");target={areaId,caseId};await rescanCase(areaId,caseId,true);}else await seedImageQueue();
 console.log(JSON.stringify(await processImageQueue({target,budgetMs:250000})));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
