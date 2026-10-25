import {claimDocumentWork} from "@/lib/timeline/document-work-lease";
import {createHash} from "node:crypto";
import {imageReviews,saveImageReview} from "@/lib/maps/image-review-store";
import {AREAS} from "@/lib/areas/registry";
import {rescanCase,requeueImageAreas} from "@/lib/maps/image-job-store";
import {getJurisdiction} from "@/lib/maps/jurisdictions";
import {mapImageCases} from "@/lib/maps/store";
import {secretMatches} from "@/lib/timeline/auth";
import {seedImageQueue,processImageQueue,imageCoverage} from "@/lib/maps/image-worker";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=300;
export async function GET(request:Request){if(!secretMatches(request.headers.get("authorization")??"",process.env.CRON_SECRET?"Bearer "+process.env.CRON_SECRET:undefined))return new Response("Unauthorized",{status:401});
 const url=new URL(request.url);if(url.searchParams.has("coverage"))return Response.json(await imageCoverage(),{headers:{"Cache-Control":"no-store"}});
 const release=await claimDocumentWork();if(!release)return Response.json({status:"busy",reason:"Another document worker is running"},{status:409});try{
 const fallbackOnly=["1","true"].includes(url.searchParams.get("fallback")??"");
 const areaId=url.searchParams.get("area"),caseId=url.searchParams.get("case");let target: {areaId:string;caseId:string}|undefined;
 if(areaId&&caseId){if(!getJurisdiction(areaId)||!(await mapImageCases(areaId)).some(c=>c.id===caseId))return new Response("Unknown case",{status:404});target={areaId,caseId};if(["1","true"].includes(url.searchParams.get("withdraw")??"")){const hidden=(await imageReviews(areaId,[caseId])).filter(r=>!r.manual&&r.visual&&!r.visual.approval?.generated).length;await saveImageReview({id:createHash("sha256").update("vision-high-v2-hold:"+areaId+caseId).digest("hex"),areaId,caseIds:[caseId],title:"Source images require explicit handwriting and context checks",sourceUrl:"image-policy:vision-high-v2",originalSrc:"",outcome:"blocked",hidden:true,minimumReviewerVersion:"vision-high-v2",reason:"Automatic images stay withheld until the stronger privacy check passes",checkedAt:new Date().toISOString()});return Response.json({status:"withdrawn",area:areaId,caseId,hidden},{headers:{"Cache-Control":"no-store"}});}await rescanCase(areaId,caseId,url.searchParams.get("resume")==="1"&&!fallbackOnly);}
 const seeded=url.searchParams.get("seed")==="1"?await seedImageQueue():undefined;
 if(seeded&&url.searchParams.get("rescan")==="1")await requeueImageAreas(Object.values(AREAS).filter(a=>a.status==="live").map(a=>a.id));
 return Response.json({seeded,...await processImageQueue({target,fallbackOnly})},{headers:{"Cache-Control":"no-store"}});
 }finally{await release();}
}
