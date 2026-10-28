import {secretMatches} from "@/lib/timeline/auth";
import {ingestionJurisdictions,publicJurisdictions,jurisdiction,isSiteReviewArea} from "@/lib/jurisdictions/registry";
import {collectJurisdiction} from "@/lib/jurisdictions/collect";
import {validateEndpoints,sampleAi,qaReport,checkRuntimeDocuments} from "@/lib/jurisdictions/onboarding";
import {claimDocumentWork} from "@/lib/timeline/document-work-lease";
export const runtime="nodejs";export const maxDuration=300;export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!secretMatches(request.headers.get("authorization")??"",process.env.CRON_SECRET?"Bearer "+process.env.CRON_SECRET:undefined))return new Response("Unauthorized",{status:401});
 const q=new URL(request.url).searchParams,command=q.get("command")??"list",id=q.get("area")??"";
 if(command==="list")return Response.json({areas:(q.get("scope")==="configured"?ingestionJurisdictions().filter(d=>!d.legacyPublic):q.get("scope")==="ingestion"?ingestionJurisdictions():publicJurisdictions()).map(d=>d.id)},{headers:{"Cache-Control":"no-store"}});
 const d=jurisdiction(id);if(!d||d.legacyPublic)return Response.json({error:"Choose a configured onboarding jurisdiction"},{status:400});
 const release=await claimDocumentWork();if(!release)return Response.json({status:"busy"},{status:409});
 try{let result:unknown;switch(command){case"validate":result=await validateEndpoints(id);break;case"backfill":result=await collectJurisdiction(id,{days:Math.min(90,Number(q.get("days")??90)),write:true});if(isSiteReviewArea(id)){const {revalidateTag,revalidatePath}=await import("next/cache");revalidateTag("map-area:"+id,{expire:0});revalidateTag("map-case-index-v1",{expire:0});revalidatePath("/");revalidatePath("/us/id/"+id);revalidatePath("/sitemap.xml");}break;case"sample-ai":result=await sampleAi(id,{n:Number(q.get("n")??5),maxUsd:Number(q.get("maxUsd")??1)});break;case"runtime-check":result=await checkRuntimeDocuments(id);break;case"qa-report":result=await qaReport(id);break;default:throw Error("Unknown onboarding command");}return Response.json(result,{headers:{"Cache-Control":"private, no-store"}});}catch(e){return Response.json({error:e instanceof Error?e.message:"Onboarding failed"},{status:400});}finally{await release();}
}
