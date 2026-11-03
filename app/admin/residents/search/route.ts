import {authorizedReviewer,sameOrigin} from "@/lib/timeline/auth";
import {previewMutationResponse} from "@/lib/runtime-environment";
import {searchResidents,ResidentAdminError} from "@/lib/admin-residents";
const headers={"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"same-origin"};
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
 const authorization=request.headers.get("authorization");if(!authorizedReviewer(authorization))return new Response("Admin access required.",{status:401,headers});
 if(!sameOrigin(request))return new Response("Origin not allowed.",{status:403,headers});
 try{
  if(Number(request.headers.get("content-length"))>4000)return new Response("Request too long.",{status:400,headers});
  const body=await request.text();if(body.length>4000)return new Response("Request too long.",{status:400,headers});
  const data=JSON.parse(body);if(!data||typeof data!=="object"||Array.isArray(data))return new Response("Invalid search.",{status:400,headers});
  return Response.json(await searchResidents(authorization,data.email,data.mode),{headers});
 }catch(error){return new Response("Search unavailable. Check the search and try again.",{status:error instanceof ResidentAdminError?error.status:error instanceof SyntaxError?400:503,headers});}
}
