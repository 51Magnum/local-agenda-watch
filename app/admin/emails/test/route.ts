import {previewMutationResponse} from "@/lib/runtime-environment";
import { randomUUID } from "node:crypto";
import { authorizedReviewer, sameOrigin } from "@/lib/timeline/auth";
import { loadEmailExamples } from "@/lib/email/examples";
import { sendAlertMail } from "@/lib/alerts";
export const maxDuration=120;
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;

 if(!authorizedReviewer(request.headers.get("authorization"))||!sameOrigin(request))return Response.json({error:"Admin authentication and same-origin submission are required"},{status:403});
 const text=await request.text();if(text.length>2000)return Response.json({error:"Request too long"},{status:400});
 let input;try{input=JSON.parse(text);}catch{return Response.json({error:"Invalid request"},{status:400});}
 if(!input||typeof input!=="object"||typeof input.to!=="string"||input.to.length>254||!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(input.to))return Response.json({error:"Enter your own single test email address"},{status:400});
 try{const example=(await loadEmailExamples()).find(e=>e.id===input.template);if(!example)return Response.json({error:"Choose a listed template"},{status:400});await sendAlertMail({to:input.to,...example.message,key:"admin-test/"+randomUUID(),unsubscribe:"https://www.localagendawatch.com/api/alerts/unsubscribe?token=preview-inactive",mode:"test"});return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Test delivery unavailable. Verify preview mail credentials and mailing address; no subscriber was contacted."},{status:503});}
}
