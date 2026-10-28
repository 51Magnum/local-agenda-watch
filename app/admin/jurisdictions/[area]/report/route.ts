import {authorizedReviewer} from "@/lib/timeline/auth";
import {readQa} from "@/lib/jurisdictions/store";
export async function GET(request:Request,{params}:{params:Promise<{area:string}>}){if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401});const report=await readQa((await params).area);return Response.json(report??{error:"No report yet"},{status:report?200:404,headers:{"Cache-Control":"private, no-store"}});}
