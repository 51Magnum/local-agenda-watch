import {previewMutationResponse} from "@/lib/runtime-environment";
import { authorizedReviewer, sameOrigin } from "@/lib/timeline/auth";
import { sendCoverageAnnouncement } from "@/lib/email/jobs";
export const maxDuration=300;
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;

 if(!authorizedReviewer(request.headers.get("authorization"))||!sameOrigin(request))return Response.json({error:"Admin authentication required"},{status:403});
 const data=await request.formData(),area=String(data.get("areaId")??"");
 try{return Response.json(await sendCoverageAnnouncement(area));}catch{return Response.json({error:"Announcements are paused pending owner approval, or the selected area is unavailable"},{status:409});}
}
