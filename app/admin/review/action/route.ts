import {revalidateTag} from "next/cache";
import { authorizedReviewer, sameOrigin } from "@/lib/timeline/auth";
import { resetDocumentRetry, getEvidenceStore } from "@/lib/timeline/store";
import { reviewField } from "@/lib/timeline/review";
export async function POST(request: Request) {
  if (!authorizedReviewer(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  if (!sameOrigin(request)) return new Response("Origin not allowed", { status: 403 });
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
