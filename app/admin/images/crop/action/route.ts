import {reviewerIdentity,sameOrigin} from "@/lib/timeline/auth";
import {previewMutationResponse} from "@/lib/runtime-environment";
import {saveManualImageCrop} from "@/lib/maps/manual-image-crop";
import {revalidatePath,revalidateTag} from "next/cache";
export const runtime="nodejs";export const maxDuration=120;
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
 const actor=reviewerIdentity(request.headers.get("authorization"));if(!actor)return Response.json({error:"Admin access required."},{status:401,headers});
 if(!sameOrigin(request))return Response.json({error:"Origin not allowed."},{status:403,headers});
 let data;try{const text=await request.text();if(text.length>4000)throw Error();data=JSON.parse(text);if(!data||data.confirmed!==true||typeof data.id!=="string"||data.id.length>200||!['save','reset'].includes(data.action)||typeof data.sourcePageHash!=="string"||!/^[a-f0-9]{64}$/.test(data.sourcePageHash))throw Error();}catch{return Response.json({error:"Invalid or unconfirmed crop request."},{status:400,headers});}
 try{const result=await saveManualImageCrop(data.id,data.box,actor,data.action==="reset",data.sourcePageHash);revalidateTag("map-case-index-v1",{expire:0});revalidatePath("/","layout");return Response.json(result,{headers});}
 catch{return Response.json({error:"Crop not saved. Check the selection and source approval. The new preview must pass its personal-information check; the existing image was kept."},{status:409,headers});}
}
