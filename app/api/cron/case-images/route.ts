import {rescanCase} from "@/lib/maps/image-job-store";
import {getJurisdiction} from "@/lib/maps/jurisdictions";
import {mapImageCases} from "@/lib/maps/store";
import {secretMatches} from "@/lib/timeline/auth";
import {seedImageQueue,processImageQueue,imageCoverage} from "@/lib/maps/image-worker";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=300;
export async function GET(request:Request){if(!secretMatches(request.headers.get("authorization")??"",process.env.CRON_SECRET?"Bearer "+process.env.CRON_SECRET:undefined))return new Response("Unauthorized",{status:401});
 const url=new URL(request.url);if(url.searchParams.has("coverage"))return Response.json(await imageCoverage(),{headers:{"Cache-Control":"no-store"}});
 const areaId=url.searchParams.get("area"),caseId=url.searchParams.get("case");let target: {areaId:string;caseId:string}|undefined;
 if(areaId&&caseId){if(!getJurisdiction(areaId)||!(await mapImageCases(areaId)).some(c=>c.id===caseId))return new Response("Unknown case",{status:404});target={areaId,caseId};await rescanCase(areaId,caseId,url.searchParams.get("resume")==="1");}
 const seeded=url.searchParams.get("seed")==="1"?await seedImageQueue():undefined;
 return Response.json({seeded,...await processImageQueue({target,fallbackOnly:["1","true"].includes(url.searchParams.get("fallback")??"")})},{headers:{"Cache-Control":"no-store"}});
}
