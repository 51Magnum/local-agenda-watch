import {authorizedReviewer,sameOrigin} from "@/lib/timeline/auth";
import {previewMutationResponse} from "@/lib/runtime-environment";
import {prepareResidentPlanChange,commitResidentPlanChange,ResidentAdminError} from "@/lib/admin-residents";
import {escapeHtml} from "@/lib/email/templates";
import {adminNavigationHtml} from "@/lib/admin-navigation";
import {PAID_PIN_LIMIT} from "@/lib/plan-policy";
const headers={"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"same-origin"};
export async function POST(request:Request){
 const disabled=previewMutationResponse();if(disabled)return disabled;
 const authorization=request.headers.get("authorization");if(!authorizedReviewer(authorization))return new Response("Admin access required.",{status:401,headers});
 if(!sameOrigin(request))return new Response("Origin not allowed.",{status:403,headers});
 if(!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))return new Response("Use the plan change form.",{status:400,headers});
 try{
  if(Number(request.headers.get("content-length"))>4000)return new Response("Request too long.",{status:400,headers});
  const body=await request.text();if(body.length>4000)return new Response("Request too long.",{status:400,headers});
  const form=new URLSearchParams(body);
  if(form.get("action")==="review"){
   const change=await prepareResidentPlanChange(authorization,form.get("residentId")??"",form.get("plan")),e=escapeHtml;
   const consequence=change.newPlan==="free"?`This keeps at most one active pin at 1 mile. ${Math.max(0,change.resident.activePins-1)} extra active pins become inactive and their email alerts stop. Locations are retained privately.`:`This allows up to ${PAID_PIN_LIMIT} active pins at 0.25–10 miles. Existing inactive pins and stopped emails stay inactive.`;
   return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Confirm resident plan change</title></head><body style="font:16px/1.6 system-ui;max-width:700px;margin:40px auto;padding:20px"><main>${adminNavigationHtml("/admin/residents")}<nav aria-label="Breadcrumb"><a href="/admin">Admin</a> › <a href="/admin/residents">Residents &amp; Plans</a> › <a href="/admin/residents/${change.resident.id}">Account details</a> › Confirm plan change</nav><h1>Confirm plan change</h1><p>Account: <strong>${e(change.resident.email)}</strong></p><p>${change.oldPlan==="paid"?"Paid":"Free"} → ${change.newPlan==="paid"?"Paid":"Free"}</p><p>${e(consequence)}</p><p>This confirmation expires in 10 minutes. The change will be recorded in the private audit history.</p><form method="post" action="/admin/residents/action"><input type="hidden" name="action" value="confirm"><input type="hidden" name="intent" value="${e(change.token)}"><label><input type="checkbox" name="confirmed" value="yes" required> I confirm this plan change and its effect on pins and alerts.</label><p><button>Confirm plan change</button></p></form><a href="/admin/residents/${change.resident.id}">Cancel and return to account</a></main></body></html>`,{headers:{...headers,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"}});
  }
  if(form.get("action")!=="confirm"||form.get("confirmed")!=="yes")return new Response("Review and confirm the plan change first.",{status:400,headers});
  const id=await commitResidentPlanChange(authorization,form.get("intent"));
  return new Response(null,{status:303,headers:{...headers,Location:"/admin/residents/"+id+"?changed=1"}});
 }catch(error){return new Response(error instanceof ResidentAdminError?error.message:"Plan change unavailable. No change was saved. Please try again.",{status:error instanceof ResidentAdminError?error.status:503,headers});}
}
