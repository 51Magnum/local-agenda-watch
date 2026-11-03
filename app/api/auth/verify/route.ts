import {NextResponse} from "next/server";
import {consumeSignIn,SESSION_COOKIE,SESSION_SECONDS} from "@/lib/resident-auth";
import {sameOrigin} from "@/lib/timeline/auth";
import {previewMutationResponse} from "@/lib/runtime-environment";
import {cookies} from "next/headers";
export const runtime="nodejs";
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
 if(!sameOrigin(request))return Response.json({error:"Submit from this site."},{status:403});
 const body=await request.text();if(body.length>200)return Response.json({error:"Invalid sign-in link."},{status:400});
 let token;try{token=JSON.parse(body).token;}catch{}
 if(typeof token!=="string")return Response.json({error:"Invalid sign-in link."},{status:400});
 const result=await consumeSignIn(token,(await cookies()).get(SESSION_COOKIE)?.value);
 if(!result)return Response.json({error:"This sign-in link expired or was already used. Request a new link."},{status:400,headers:{"Cache-Control":"no-store"}});
 const response=NextResponse.json({redirect:result.returnTo},{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 response.cookies.set(SESSION_COOKIE,result.token,{secure:true,httpOnly:true,sameSite:"lax",path:"/",maxAge:SESSION_SECONDS,expires:result.expires});return response;
}
