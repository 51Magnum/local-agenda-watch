import { authorizedReviewer } from "@/lib/timeline/auth";
import { loadEmailExamples } from "@/lib/email/examples";
export const dynamic="force-dynamic";
export async function GET(request:Request){if(!authorizedReviewer(request.headers.get("authorization")))return Response.json({error:"Admin authentication required"},{status:403});return Response.json(await loadEmailExamples(),{headers:{"Cache-Control":"no-store"}});}
