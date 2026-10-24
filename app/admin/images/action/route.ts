import { authorizedReviewer, sameOrigin } from "@/lib/timeline/auth";
import { auditDisplayedImages } from "@/lib/maps/audit-images";
import { hideImage } from "@/lib/maps/image-review-store";
import { purgeUnverifiedVisualAssets } from "@/lib/maps/visual-store";
import { revalidatePath } from "next/cache";
export const runtime="nodejs";
export const maxDuration=120;
export async function POST(request:Request){
 if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401});
 if(!sameOrigin(request))return new Response("Origin not allowed",{status:403});
 const form=await request.formData(),action=form.get("action");
 if(action==="purge")return Response.json({removedAssets:await purgeUnverifiedVisualAssets()},{headers:{"Cache-Control":"no-store"}});
 if(action==="audit"){const result=await auditDisplayedImages({areaId:String(form.get("area")??"")||undefined,limit:Math.min(10,Math.max(1,Number(form.get("limit")??2))),deadline:Date.now()+100000});revalidatePath("/","layout");return Response.json(result,{headers:{"Cache-Control":"no-store"}});}
 if(action==="hide"){await hideImage(String(form.get("id")??""));revalidatePath("/","layout");return Response.redirect(new URL("/admin/images",request.url),303);}
 return new Response("Invalid action",{status:400});
}
