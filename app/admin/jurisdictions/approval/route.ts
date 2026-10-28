import {previewMutationResponse} from "@/lib/runtime-environment";
import {reviewerIdentity,sameOrigin} from "@/lib/timeline/auth";
import {approveQa} from "@/lib/jurisdictions/store";
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
const actor=reviewerIdentity(request.headers.get("authorization"));if(!actor||!sameOrigin(request))return new Response("Unauthorized",{status:403});try{const f=await request.formData();await approveQa(String(f.get("areaId")??""),String(f.get("qaId")??""),actor);return Response.redirect(new URL("/admin/jurisdictions",request.url),303);}catch(e){return Response.json({error:e instanceof Error?e.message:"Approval failed"},{status:400});}}
