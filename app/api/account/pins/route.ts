import {currentResident} from "@/lib/resident-session";
import {removeResidentPin,saveResidentPin} from "@/lib/resident-account";
import {sameOrigin} from "@/lib/timeline/auth";
import {previewMutationResponse} from "@/lib/runtime-environment";
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
 if(!sameOrigin(request))return new Response("Submit from this site.",{status:403});
 const resident=await currentResident();if(!resident)return new Response("Sign in required.",{status:401});
 if(Number(request.headers.get("content-length"))>4000)return new Response("Request too long.",{status:400});
 const data=await request.formData(),id=String(data.get("id")??""),source=String(data.get("source")??"saved");
 if(id&&!/^[a-f0-9-]{36}$/i.test(id))return new Response("Pin not found.",{status:404});
 try{
  if(data.get("action")!=="remove"&&["longitude","latitude","radiusMiles"].some(key=>typeof data.get(key)!=="string"||!String(data.get(key)).trim()))return new Response("Choose a pin location and radius.",{status:400});
  const ok=data.get("action")==="remove"?!!id&&await removeResidentPin(resident,id,source):await saveResidentPin(resident,{kind:"place",label:data.get("label"),coordinates:[Number(data.get("longitude")),Number(data.get("latitude"))],radiusMiles:Number(data.get("radiusMiles"))},id||undefined,source,data.get("alertsEnabled")==="on");
  if(!ok)return new Response("Pin not found.",{status:404});
 }catch{return new Response("Pin could not be saved. Check your plan’s pin allowance, radius and location. Free allows one pin at 1 mile.",{status:400});}
 return new Response(null,{status:303,headers:{Location:(data.get("returnTo")==="/profile"?"/profile":"/pins")+"?saved=1","Cache-Control":"no-store"}});
}
