import {revalidateTag} from "next/cache";
import { authorizedReviewer, sameOrigin } from "@/lib/timeline/auth";
import { resetDocumentRetry, getEvidenceStore } from "@/lib/timeline/store";
import { reviewBatch, undoBatch, reviewField, type ReviewInput } from "@/lib/timeline/review";
export async function POST(request: Request) {
  if (!authorizedReviewer(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  if (!sameOrigin(request)) return new Response("Origin not allowed", { status: 403 });
  if(request.headers.get("content-type")?.includes("application/json")){
    try{
      const raw=await request.text();if(raw.length>2000000)return Response.json({error:"Request too large"},{status:413});
      const input=JSON.parse(raw),store=getEvidenceStore();
      let result;
      if(input.action==="undo"&&typeof input.batchId==="string")result={fields:await undoBatch(store,input.batchId)};
      else {
        if(!Array.isArray(input.items)||input.items.some((i:ReviewInput)=>!i||typeof i.id!=="string"||!["approve","reject"].includes(i.action)|| (i.value!==undefined&&typeof i.value!=="string") || (i.note!==undefined&&typeof i.note!=="string")))return Response.json({error:"Invalid review request"},{status:400});
        result=await reviewBatch(store,input.items,input.onlyPassing===true);
      }
      revalidateTag("case-timeline-v2",{expire:0});return Response.json(result,{headers:{"Cache-Control":"no-store"}});
    }catch(error){return Response.json({error:error instanceof Error?error.message:"Review failed"},{status:409});}
  }
  const form = await request.formData();
  const action = form.get("action");
  if(action==="retry"){
    try{await resetDocumentRetry(getEvidenceStore(),String(form.get("id")??""));return Response.redirect(new URL("/admin/review",request.url),303);}
    catch{return new Response("Document not found",{status:404});}
  }
  if (action !== "approve" && action !== "reject") return new Response("Invalid action", { status: 400 });
  try {
    await reviewField(getEvidenceStore(), { id: String(form.get("id") ?? ""), action, value: String(form.get("value") ?? ""), note: String(form.get("note") ?? "") });
    revalidateTag("case-timeline-v2",{expire:0});
    return Response.redirect(new URL("/admin/review", request.url), 303);
  } catch (error) { return new Response(error instanceof Error ? error.message : "Review failed", { status: 409 }); }
}
