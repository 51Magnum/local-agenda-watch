import {previewMutationResponse} from "@/lib/runtime-environment";
import {authorizedReviewer,sameOrigin} from "@/lib/timeline/auth";
import {updateCorrection} from "@/lib/corrections";
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401});if(!sameOrigin(request))return new Response("Origin not allowed",{status:403});const form=await request.formData(),id=String(form.get("id")),status=String(form.get("status"));if(!/^[a-f0-9-]{36}$/.test(id)||!["new","resolved"].includes(status))return new Response("Invalid action",{status:400});await updateCorrection(id,status);return Response.redirect(new URL("/admin/corrections",request.url),303);}
