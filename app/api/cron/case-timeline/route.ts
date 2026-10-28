import {previewMutationResponse} from "@/lib/runtime-environment";
import {revalidateTag} from "next/cache";
import { refreshTimelines } from "@/lib/timeline/refresh";
import { secretMatches } from "@/lib/timeline/auth";
import { acquireLease,getEvidenceStore,releaseLease } from "@/lib/timeline/store";
import {AREAS} from "@/lib/areas/registry";
import {schedulerWindow,localClock,planSchedule,finishSchedule} from "@/lib/timeline/schedule";
import {scheduleSlotCompleted,scheduleDue,readSchedule,claimSchedule,releaseSchedule} from "@/lib/timeline/schedule-store";
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 const disabled=previewMutationResponse();if(disabled)return disabled;

  const authorization = request.headers.get("authorization") ?? "";
  if (!secretMatches(authorization, process.env.CRON_SECRET ? "Bearer " + process.env.CRON_SECRET : undefined)) return new Response("Unauthorized", { status: 401 });
  const now=new Date(),url=new URL(request.url),manual=url.searchParams.get("manual")==="1",force=manual&&url.searchParams.get("force")==="1",discoverOnly=manual&&url.searchParams.get("discoveryOnly")==="1";
  const skipped=(reason:string,alreadyCompleted=false)=>{console.info("[timeline:scheduler]",JSON.stringify({modes:["skipped"],reason,checked:0}));return Response.json({status:"skipped",reason,modes:[],checked:0,alreadyCompleted},{status:alreadyCompleted?200:409});};
  const window=schedulerWindow(now,manual);
  if(!force&&!window)return skipped("Outside 05:00–09:59 / 14:00–18:59 America/Denver windows");
  let snapshot;
  try{
    if(!force&&window&&!await scheduleDue(`${window.date}:${window.period}`,window.period,Object.values(AREAS).filter(a=>a.status==="live"&&a.timeline).map(a=>({areaId:a.id,today:localClock(now,a.timezone).date}))))return skipped("Nothing due or this local-time slot already completed",Boolean(window&&await scheduleSlotCompleted(`${window.date}:${window.period}`)));
    snapshot=await readSchedule();
  }catch(error){console.error("[timeline:scheduler] Schedule storage unavailable",error instanceof Error?error.message:"Unknown error");return Response.json({error:"Schedule storage unavailable"},{status:503});}
  let plan=planSchedule(snapshot,AREAS,now,{manual,force});
  if(!plan)return skipped("Nothing due or this local-time slot already completed",Boolean(window&&snapshot.slots[`${window.date}:${window.period}`]));
  if (!process.env.OPENAI_API_KEY && !discoverOnly) return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  const scheduleLease=await claimSchedule();
  if(!scheduleLease)return Response.json({status:"already running"},{status:409});
  let nextSchedule;
  try {
  // Re-read under the scheduler lease so simultaneous invocations cannot both claim the same slot.
  snapshot=await readSchedule();plan=planSchedule(snapshot,AREAS,now,{manual,force});
  if(!plan)return skipped("This slot completed while waiting for the scheduler lease",true);
  if(force)for(const tag of [...Object.values(AREAS).filter(a=>a.status==="live").map(a=>a.id+":cases"),"nampa:pz:active","nampa:pz:completed","nampa:scheduled","nampa:primegov"])revalidateTag(tag,{expire:0});
  if(discoverOnly)plan.modes.push("source-discovery-only");
  console.info("[timeline:scheduler]",JSON.stringify({modes:plan.modes,meetings:plan.meetingIds.length,fullSweep:plan.fullSweep}));
  let store;
  let lease;
  try { store = getEvidenceStore({buffered:true}); lease = await acquireLease(store, "ingest"); }
  catch (error) {
    console.error("[timeline:cron] Storage unavailable", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Timeline storage is not configured or reachable" }, { status: 503 });
  }
  if (!lease) return Response.json({ status: "already running" }, { status: 409 });
  try {
    const meetingDatesByArea:Record<string,string[]>={};
    if(!plan.fullSweep)for(const m of snapshot.meetings)if(plan.meetingIds.includes(m.id))(meetingDatesByArea[m.areaId]??=[]).push(m.date);
    const {run,maps,feeds,checkedCases}=await refreshTimelines(store,{plan,discoverOnly,includeMaps:plan.fullSweep,meetingDatesByArea:plan.fullSweep?undefined:meetingDatesByArea});
    nextSchedule=finishSchedule(snapshot,plan,feeds,await store.read(),AREAS,new Date(),checkedCases);
    revalidateTag("case-timeline-v2",{expire:0});
    console.warn("[timeline:health]",JSON.stringify((await import("@/lib/timeline/health")).timelineHealth(nextSchedule,AREAS)));
    return Response.json({status:"completed",sweeps:nextSchedule.sweeps,modes:plan.modes,maps,checked:run.checked,processed:run.processed,skipped:run.skipped,areas:run.areas,hosts:run.hosts,
      tokens:{calls:run.usage?.length??0,input:run.usage?.reduce((n,u)=>n+u.inputTokens,0)??0,output:run.usage?.reduce((n,u)=>n+u.outputTokens,0)??0,total:run.usage?.reduce((n,u)=>n+u.totalTokens,0)??0},
      transfer:run.transfer,errors:run.errors.length}, {headers:{"Cache-Control":"no-store"}});
  } finally { await releaseLease(store, "ingest", lease); }
  } finally {await releaseSchedule(scheduleLease,nextSchedule);}
}
