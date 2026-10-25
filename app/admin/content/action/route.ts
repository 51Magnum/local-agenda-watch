import {authorizedReviewer,sameOrigin} from "@/lib/timeline/auth";
import {GET} from "@/app/api/cron/project-content/route";
export const runtime="nodejs";export const maxDuration=300;
export async function POST(request:Request){if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401});if(!sameOrigin(request))return new Response("Origin not allowed",{status:403});return GET(new Request(new URL("/api/cron/project-content"+new URL(request.url).search,request.url),{headers:{Authorization:"Bearer "+process.env.CRON_SECRET}}));}
