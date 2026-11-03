import {GENERIC_SIGN_IN_MESSAGE,requestSignIn,signInAvailable} from "@/lib/resident-auth";
import {sameOrigin} from "@/lib/timeline/auth";
import {previewMutationResponse} from "@/lib/runtime-environment";
export const runtime="nodejs";
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
 if(!sameOrigin(request))return Response.json({error:"Submit from this site."},{status:403});
 if(!signInAvailable())return Response.json({error:"Sign-in email is temporarily unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
 const body=await request.text();if(body.length>3000)return Response.json({error:"Request too long."},{status:400});
 let data;try{data=JSON.parse(body);if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Invalid input");}catch{return Response.json({error:"Invalid request."},{status:400});}
 if(!data.website){try{const ip=(request.headers.get("x-vercel-forwarded-for")??request.headers.get("x-forwarded-for")??"unknown").split(",")[0].trim().slice(0,100);await requestSignIn(data.email,ip,data.next);}catch{console.error("[resident-auth] Sign-in request could not be delivered");}}
 return Response.json({message:GENERIC_SIGN_IN_MESSAGE},{status:202,headers:{"Cache-Control":"no-store"}});
}
