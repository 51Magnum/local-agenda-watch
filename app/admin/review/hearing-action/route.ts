import { revalidateTag } from "next/cache";
import { authorizedReviewer, sameOrigin } from "@/lib/timeline/auth";
import { validateHearingOverride } from "@/lib/hearings/overrides";
import { saveHearingOverride } from "@/lib/hearings/store";
export const maxDuration=60;
export async function POST(request:Request) {
  if(!authorizedReviewer(request.headers.get("authorization"))||!sameOrigin(request))return new Response("Admin authentication and same-origin submission required",{status:403});
  if(Number(request.headers.get("content-length"))>16000)return new Response("Request too long",{status:413});
  try{
    const form=await request.formData(),area=String(form.get("area")??""),id=String(form.get("case")??""),hearing=String(form.get("hearing")??"");
    if(!/^[A-Z0-9-]{2,80}$/.test(id)||!/^.{1,80}:\d{4}-\d{2}-\d{2}$/.test(hearing))throw Error("Invalid hearing reference");
    const override=validateHearingOverride(area,form);
    // Guidance and participation URLs are restricted to official hosts by the
    // validator. CivicPlus blocks server requests to those public pages; that
    // must not prevent correcting a separately verified meeting/document link.
    for(const field of ["meeting_url","agenda_url","packet_url"] as const){
      if(typeof override[field]!=="string")continue;
      const response=await fetch(override[field],{method:"GET",signal:AbortSignal.timeout(10000),cache:"no-store"});
      if(!response.ok){await response.body?.cancel();throw Error("An official link could not be verified; no override was saved");}
      const reader=response.body?.getReader();const first=reader?await reader.read():undefined;await reader?.cancel();
      if(first&&/Document Not Found|Just a moment|Attention Required/i.test(new TextDecoder().decode(first.value)))throw Error("An official link is unavailable; no override was saved");
    }
    await saveHearingOverride(area,id,hearing,override);
    revalidateTag("case-timeline-v2",{expire:0});revalidateTag("map-area:"+area,{expire:0});
    return Response.redirect(new URL("/admin/review?"+new URLSearchParams({hearing_area:area,hearing_case:id}),request.url),303);
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Meeting override failed"},{status:400});}
}
