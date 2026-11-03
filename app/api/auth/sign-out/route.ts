import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {SESSION_COOKIE,revokeResidentSession} from "@/lib/resident-auth";
import {sameOrigin} from "@/lib/timeline/auth";
import {previewMutationResponse} from "@/lib/runtime-environment";
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
 if(!sameOrigin(request))return new Response("Submit from this site.",{status:403});
 await revokeResidentSession((await cookies()).get(SESSION_COOKIE)?.value);
 const response=NextResponse.redirect(new URL("/sign-in",request.url),303);response.headers.set("Cache-Control","no-store");response.cookies.set(SESSION_COOKIE,"",{secure:true,httpOnly:true,sameSite:"lax",path:"/",maxAge:0});return response;
}
