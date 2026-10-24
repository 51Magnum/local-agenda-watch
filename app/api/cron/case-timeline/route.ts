import {revalidateTag} from "next/cache";
import { refreshTimelines } from "@/lib/timeline/refresh";
import { secretMatches } from "@/lib/timeline/auth";
import { acquireLease,getEvidenceStore,releaseLease } from "@/lib/timeline/store";
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!secretMatches(authorization, process.env.CRON_SECRET ? "Bearer " + process.env.CRON_SECRET : undefined)) return new Response("Unauthorized", { status: 401 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  let store;
  let lease;
  try { store = getEvidenceStore({buffered:true}); lease = await acquireLease(store, "ingest"); }
  catch (error) {
    console.error("[timeline:cron] Storage unavailable", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Timeline storage is not configured or reachable" }, { status: 503 });
  }
  if (!lease) return Response.json({ status: "already running" }, { status: 409 });
  try {
    const {run,maps}=await refreshTimelines(store);
    revalidateTag("case-timeline-v2",{expire:0});
    return Response.json({maps,checked:run.checked,processed:run.processed,skipped:run.skipped,areas:run.areas,hosts:run.hosts,
      tokens:{calls:run.usage?.length??0,input:run.usage?.reduce((n,u)=>n+u.inputTokens,0)??0,output:run.usage?.reduce((n,u)=>n+u.outputTokens,0)??0,total:run.usage?.reduce((n,u)=>n+u.totalTokens,0)??0},
      transfer:run.transfer,errors:run.errors.length}, {headers:{"Cache-Control":"no-store"}});
  } finally { await releaseLease(store, "ingest", lease); }
}
