import {readMapSnapshot} from "@/lib/maps/store";
import {fallbackCaseImage} from "@/lib/maps/fallback-image";
import {imageReviews} from "@/lib/maps/image-review-store";
import { authorizedReviewer, sameOrigin } from "@/lib/timeline/auth";
import { auditDisplayedImages } from "@/lib/maps/audit-images";
import {processImageQueue,seedImageQueue} from "@/lib/maps/image-worker";
import {rescanCase} from "@/lib/maps/image-job-store";
import {getJurisdiction} from "@/lib/maps/jurisdictions";
import { hideImage, selectImage, unhideImage } from "@/lib/maps/image-review-store";
import { purgeUnverifiedVisualAssets } from "@/lib/maps/visual-store";
import { revalidatePath } from "next/cache";
export const runtime="nodejs";
export const maxDuration=300;
export async function POST(request:Request){
 if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401});
 if(!sameOrigin(request))return new Response("Origin not allowed",{status:403});
 const form=await request.formData(),action=form.get("action");
 if(action==="purge")return Response.json({removedAssets:await purgeUnverifiedVisualAssets()},{headers:{"Cache-Control":"no-store"}});
 if(action==="audit"){const result=await auditDisplayedImages({areaId:String(form.get("area")??"")||undefined,limit:Math.min(10,Math.max(1,Number(form.get("limit")??2))),deadline:Date.now()+100000});revalidatePath("/","layout");return Response.json(result,{headers:{"Cache-Control":"no-store"}});}
 const area=String(form.get("area")??""),caseId=String(form.get("caseId")??"");
 if(action==="use-map"){if(!getJurisdiction(area)||!caseId)return new Response("Invalid case",{status:400});const item=(await readMapSnapshot(area,{caseIds:[caseId],includeFlum:false}))?.cases[0];if(!item)return new Response("Case not found",{status:404});await fallbackCaseImage(area,item);const row=(await imageReviews(area,[caseId])).find(r=>r.visual?.approval?.generated);if(row)await selectImage(row.id);revalidatePath("/","layout");return Response.redirect(new URL("/admin/images/"+area+"/"+encodeURIComponent(caseId),request.url),303);}
 if(action==="rescan"){if(!getJurisdiction(area)||!caseId||caseId.length>100)return new Response("Invalid case",{status:400});await rescanCase(area,caseId);await processImageQueue({target:{areaId:area,caseId}});revalidatePath("/","layout");return Response.redirect(new URL("/admin/images/"+area+"/"+encodeURIComponent(caseId),request.url),303);}
 if(action==="run-next"){await seedImageQueue();return Response.json(await processImageQueue(),{headers:{"Cache-Control":"no-store"}});}
 if(action==="select"||action==="unhide"){try{if(action==="select")await selectImage(String(form.get("id")??""));else await unhideImage(String(form.get("id")??""));}catch{return new Response("The image has not passed privacy review",{status:400});}revalidatePath("/","layout");return Response.redirect(new URL(getJurisdiction(area)&&caseId?"/admin/images/"+area+"/"+encodeURIComponent(caseId):"/admin/images",request.url),303);}
 if(action==="hide"){await hideImage(String(form.get("id")??""));revalidatePath("/","layout");return Response.redirect(new URL("/admin/images",request.url),303);}
 return new Response("Invalid action",{status:400});
}
