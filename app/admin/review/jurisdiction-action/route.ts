import {previewMutationResponse} from "@/lib/runtime-environment";
import {reviewerIdentity,sameOrigin} from "@/lib/timeline/auth";
import {decideException,pauseJurisdiction} from "@/lib/jurisdictions/self-check-store";
import {revalidatePath,revalidateTag} from "next/cache";
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
 const reviewer=reviewerIdentity(request.headers.get("authorization"));if(!reviewer)return new Response("Unauthorized",{status:401});
 if(!sameOrigin(request))return new Response("Origin not allowed",{status:403});
 const form=await request.formData(),areaId=String(form.get("areaId")??""),action=String(form.get("action")??"");
 if(!/^[a-z]+(?:-[a-z]+)*$/.test(areaId))return new Response("Invalid area",{status:400});
 try{
  if(action==="pause")await pauseJurisdiction(areaId,reviewer);
  else if(["approve","fix","hide"].includes(action))await decideException({areaId,recordId:String(form.get("recordId")??""),sourceHash:String(form.get("sourceHash")??""),action:action as "approve"|"fix"|"hide",reviewer});
  else return new Response("Invalid action",{status:400});
  revalidateTag("map-case-index-v1",{expire:0});revalidateTag("map-area:"+areaId,{expire:0});revalidatePath("/us/id/"+areaId,"layout");revalidatePath("/");
  return Response.redirect(new URL("/admin/review",request.url),303);
 }catch(e){return Response.json({error:(e as Error).message},{status:409});}
}
