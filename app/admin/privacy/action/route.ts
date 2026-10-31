import {previewMutationResponse} from "@/lib/runtime-environment";
import {authorizedReviewer,sameOrigin} from "@/lib/timeline/auth";
import {setPrivacyOverride} from "@/lib/residential-privacy-store";
import {revalidateTag,revalidatePath} from "next/cache";
import {AREAS} from "@/lib/areas/registry";
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401});if(!sameOrigin(request))return new Response("Origin not allowed",{status:403});const f=await request.formData(),area=String(f.get("area")),id=String(f.get("caseId")).trim().toUpperCase(),mode=String(f.get("mode")),reason=String(f.get("reason")).trim();if(!AREAS[area]||!/^[-A-Z0-9]{2,80}$/.test(id)||!["auto","protect","public"].includes(mode)||!reason||reason.length>500)return new Response("Invalid policy",{status:400});await setPrivacyOverride(area,id,mode,reason);revalidateTag("residential-privacy-v1",{expire:0});revalidateTag("map-case-index-v1",{expire:0});revalidateTag("case-timeline-v2",{expire:0});revalidatePath("/","layout");return Response.redirect(new URL("/admin/privacy",request.url),303);}
