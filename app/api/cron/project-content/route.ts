import {claimDocumentWork} from "@/lib/timeline/document-work-lease";
import {secretMatches} from "@/lib/timeline/auth";
import {enrichProjectContent} from "@/lib/project-content-worker";
import {refreshSiteContent,MAP_INDEX_TAG} from "@/lib/maps/case-index";
import {revalidateTag} from "next/cache";
export const runtime="nodejs";export const maxDuration=300;export const dynamic="force-dynamic";
export async function GET(request:Request){if(!secretMatches(request.headers.get("authorization")??"",process.env.CRON_SECRET?"Bearer "+process.env.CRON_SECRET:undefined))return new Response("Unauthorized",{status:401});const release=await claimDocumentWork();if(!release)return Response.json({status:"busy",reason:"Another document worker is running"},{status:409});try{const q=new URL(request.url).searchParams;const result=await enrichProjectContent({areaId:q.get("area")??undefined,caseId:q.get("case")??undefined});if(result.areas.some(a=>a.generated>0))await refreshSiteContent();revalidateTag("case-timeline-v2",{expire:0});revalidateTag(MAP_INDEX_TAG,{expire:0});for(const area of result.areas)revalidateTag("map-area:"+area.area,{expire:0});return Response.json(result,{headers:{"Cache-Control":"no-store"}});}finally{await release();}}
