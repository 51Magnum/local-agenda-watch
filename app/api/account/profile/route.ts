import {currentResident} from "@/lib/resident-session";
import {saveResidentName,stopResidentWatch} from "@/lib/resident-account";
import {sameOrigin} from "@/lib/timeline/auth";
import {previewMutationResponse} from "@/lib/runtime-environment";
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
 if(!sameOrigin(request))return new Response("Submit from this site.",{status:403});
 const resident=await currentResident();if(!resident)return new Response("Sign in required.",{status:401});
 if(Number(request.headers.get("content-length"))>4000)return new Response("Request too long.",{status:400});
 const data=await request.formData();
 try{if(data.get("action")==="stop"){const id=String(data.get("id")??"");if(!/^[a-f0-9-]{36}$/i.test(id)||!await stopResidentWatch(resident,id))return new Response("Watch not found.",{status:404});}else await saveResidentName(resident,data.get("displayName"));}
 catch{return new Response("Profile could not be updated. Check the submitted values.",{status:400});}
 return new Response(null,{status:303,headers:{Location:"/profile?saved=1","Cache-Control":"no-store"}});
}
