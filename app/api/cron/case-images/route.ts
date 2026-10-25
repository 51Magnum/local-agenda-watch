import {imageReviews,hideImage} from "@/lib/maps/image-review-store";
import {rescanCase} from "@/lib/maps/image-job-store";
import {getJurisdiction} from "@/lib/maps/jurisdictions";
import {mapImageCases} from "@/lib/maps/store";
import {secretMatches} from "@/lib/timeline/auth";
import {seedImageQueue,processImageQueue,imageCoverage} from "@/lib/maps/image-worker";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=300;
export async function GET(request:Request){if(!secretMatches(request.headers.get("authorization")??"",process.env.CRON_SECRET?"Bearer "+process.env.CRON_SECRET:undefined))return new Response("Unauthorized",{status:401});
 const url=new URL(request.url);if(url.searchParams.has("coverage"))return Response.json(await imageCoverage(),{headers:{"Cache-Control":"no-store"}});
 const fallbackOnly=["1","true"].includes(url.searchParams.get("fallback")??"");
 const areaId=url.searchParams.get("area"),caseId=url.searchParams.get("case");let target: {areaId:string;caseId:string}|undefined;
 if(areaId&&caseId){if(!getJurisdiction(areaId)||!(await mapImageCases(areaId)).some(c=>c.id===caseId))return new Response("Unknown case",{status:404});target={areaId,caseId};if(["1","true"].includes(url.searchParams.get("withdraw")??"")){let hidden=0;for(const row of await imageReviews(areaId,[caseId]))if(!row.manual&&row.visual&&!row.visual.approval?.generated){await hideImage(row.id);hidden++;}return Response.json({status:"withdrawn",area:areaId,caseId,hidden},{headers:{"Cache-Control":"no-store"}});}await rescanCase(areaId,caseId,url.searchParams.get("resume")==="1"&&!fallbackOnly);}
 const seeded=url.searchParams.get("seed")==="1"?await seedImageQueue():undefined;
 return Response.json({seeded,...await processImageQueue({target,fallbackOnly})},{headers:{"Cache-Control":"no-store"}});
}
