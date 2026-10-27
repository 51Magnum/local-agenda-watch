import {authorizedReviewer,sameOrigin} from "@/lib/timeline/auth";
import {collectJurisdiction} from "@/lib/jurisdictions/collect";
import {validateEndpoints,sampleAi,qaReport,checkRuntimeDocuments} from "@/lib/jurisdictions/onboarding";
import {approveQa} from "@/lib/jurisdictions/store";
import {replacePrivateImage} from "@/lib/jurisdictions/images";
export const runtime="nodejs";export const maxDuration=300;
export async function POST(request:Request){
 if(!authorizedReviewer(request.headers.get("authorization"))||!sameOrigin(request))return Response.json({error:"Admin authentication and same origin required"},{status:403});
 try{const input=await request.json();if(typeof input.areaId!=="string"||typeof input.command!=="string")throw Error("Invalid operation");let result:unknown;
 switch(input.command){case"validate":result=await validateEndpoints(input.areaId);break;case"backfill":{const s=await collectJurisdiction(input.areaId,{write:true});result={applications:s.applications.length,meetings:s.meetings.length,health:s.health,complete:s.complete};break;}case"sample-ai":result=await sampleAi(input.areaId);break;case"runtime-check":result=await checkRuntimeDocuments(input.areaId);break;case"qa-report":result=await qaReport(input.areaId);break;case"remove-image":case"replace-image":if(typeof input.caseId!=="string")throw Error("Choose a case");result=await replacePrivateImage(input.areaId,input.caseId,input.command==="replace-image"?input.sourceUrl:undefined);break;case"approve":if(typeof input.qaId!=="string")throw Error("Choose the passing QA report");result=await approveQa(input.areaId,input.qaId,"admin");break;default:throw Error("Unknown operation");}
 return Response.json(result,{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Operation failed"},{status:400,headers:{"Cache-Control":"private, no-store"}});}
}
