import {authorizedReviewer} from "@/lib/timeline/auth";
import {privateProject} from "@/lib/jurisdictions/preview";
export async function GET(request:Request,{params}:{params:Promise<{area:string}>}){if(!authorizedReviewer(request.headers.get("authorization")))return new Response("Unauthorized",{status:401});const {area}=await params,id=new URL(request.url).searchParams.get("case");const data=id?await privateProject(area,id):undefined;return Response.json(data??{error:"Not found"},{status:data?200:404,headers:{"Cache-Control":"private, no-store"}});}
