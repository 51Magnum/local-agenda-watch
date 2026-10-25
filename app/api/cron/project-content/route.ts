import {secretMatches} from "@/lib/timeline/auth";
import {enrichProjectContent} from "@/lib/project-content-worker";
import {MAP_INDEX_TAG} from "@/lib/maps/case-index";
import {revalidateTag} from "next/cache";
export const runtime="nodejs";export const maxDuration=300;export const dynamic="force-dynamic";
export async function GET(request:Request){if(!secretMatches(request.headers.get("authorization")??"",process.env.CRON_SECRET?"Bearer "+process.env.CRON_SECRET:undefined))return new Response("Unauthorized",{status:401});const q=new URL(request.url).searchParams;const result=await enrichProjectContent({areaId:q.get("area")??undefined,caseId:q.get("case")??undefined});revalidateTag("case-timeline-v2",{expire:0});revalidateTag(MAP_INDEX_TAG,{expire:0});return Response.json(result,{headers:{"Cache-Control":"no-store"}});}
