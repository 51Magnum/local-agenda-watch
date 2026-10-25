import {authorizedReviewer,sameOrigin} from "@/lib/timeline/auth";
import {GET} from "@/app/api/cron/case-timeline/route";
export const runtime="nodejs";
export const maxDuration=300;
export async function POST(request:Request){if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401});if(!sameOrigin(request))return new Response("Origin not allowed",{status:403});if(!process.env.CRON_SECRET)return Response.json({error:"CRON_SECRET is not configured"},{status:503});const url=new URL("/api/cron/case-timeline?manual=1&force=1"+(new URL(request.url).searchParams.get("discoveryOnly")==="1"?"&discoveryOnly=1":""),request.url);return GET(new Request(url,{headers:{Authorization:"Bearer "+process.env.CRON_SECRET}}));}
