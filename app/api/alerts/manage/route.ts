import { alertsDb, alertScope } from "@/lib/alerts";
import { sameOrigin } from "@/lib/timeline/auth";
import { escapeHtml } from "@/lib/email/templates";
import { projectDetail } from "@/lib/maps/project-detail";
import type { StoredWatchTarget } from "@/lib/alerts";
const valid=(token:string)=>/^[\w-]{43}$/.test(token);
const headers={"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"};
async function owner(token:string){if(!valid(token))return null;return (await(await alertsDb()).query("SELECT email,scope FROM law_alert_subscriptions WHERE unsubscribe_token=$1 AND scope=$2 LIMIT 1",[token,alertScope()])).rows[0] as {email:string;scope:string}|undefined;}
export async function GET(request:Request){
 const token=new URL(request.url).searchParams.get("token")??"",account=await owner(token);
 if(!account)return new Response("This watch-management link is inactive. Use the link in your confirmed subscription email.",{status:400,headers});
 const rows=(await(await alertsDb()).query("SELECT id,target,unsubscribed_at,confirmed_at,coverage_announcements FROM law_alert_subscriptions WHERE email=$1 AND scope=$2 ORDER BY created_at",[account.email,account.scope])).rows as {id:string;target:StoredWatchTarget;unsubscribed_at:string|null;confirmed_at:string|null;coverage_announcements:boolean}[];
 const items=await Promise.all(rows.map(async row=>{
  const target=row.target;let title=target.kind==="project"?"Watched project "+target.caseId:target.label;
  if(target.kind==="project")try{title=(await projectDetail(target.areaId,target.caseId))?.item.popup?.projectName??title;}catch{/* Unavailable source data must never prevent unsubscribing. */}
  const status=row.unsubscribed_at?"Unsubscribed":!row.confirmed_at?"Awaiting email confirmation":target.kind==="pending"&&target.label!=="Internal correction notices"?"Email confirmed; choose a project or place to start updates":"Active";
  return `<section><h2>${escapeHtml(title)}</h2><p>${target.kind==="place"?`Within ${target.radiusMiles} ${target.radiusMiles===1?"mile":"miles"} of your saved place.`:target.kind==="project"?"This project and its related cases.":"Interest or internal-notification preferences."}</p><p>${status}</p>${!row.unsubscribed_at?`<form method="post"><input type="hidden" name="id" value="${escapeHtml(row.id)}">${target.kind==="place"?`<label><input type="checkbox" name="announcements" ${row.coverage_announcements?"checked":""}> Also send coverage announcements relevant to this place</label><button name="action" value="preferences">Save announcement preference</button>`:""}<button name="action" value="remove">Stop these emails</button></form>`:""}</section>`;
 }));
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Manage your watches · Local Agenda Watch</title><style>body{font:16px/1.6 Arial,sans-serif;background:#f2f6f5;color:#20383b;margin:0}main{max-width:600px;padding:24px;margin:auto}section{background:white;border:1px solid #ccdcd8;border-radius:10px;padding:20px;margin:20px 0}button{display:block;min-height:44px;padding:10px 18px;background:#007c78;color:white;border:0;border-radius:8px;margin-top:14px;cursor:pointer}h2{font-size:20px}</style><main><h1>Manage your watches</h1><p>Changes apply to the email address associated with this private link. Clearing browser data does not unsubscribe email.</p>${items.join("")}<a href="/api/alerts/unsubscribe?token=${token}">Unsubscribe from all alerts</a></main></html>`,{headers});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response("Submit from this page.",{status:403,headers});
 const token=new URL(request.url).searchParams.get("token")??"",account=await owner(token);if(!account)return new Response("Inactive management link",{status:400,headers});
 const data=await request.formData(),id=String(data.get("id")??""),action=String(data.get("action")??"");
 if(!/^[\da-f-]{36}$/i.test(id)||!["remove","preferences"].includes(action))return new Response("Invalid watch preference",{status:400,headers});
 const db=await alertsDb();
 if(action==="remove")await db.query("UPDATE law_alert_subscriptions SET unsubscribed_at=now() WHERE id=$1 AND email=$2 AND scope=$3",[id,account.email,account.scope]);
 else await db.query("UPDATE law_alert_subscriptions SET coverage_announcements=$4 WHERE id=$1 AND email=$2 AND scope=$3 AND target->>'kind'='place' AND unsubscribed_at IS NULL",[id,account.email,account.scope,data.get("announcements")==="on"]);
 return new Response(null,{status:303,headers:{Location:"/api/alerts/manage?token="+token,"Cache-Control":"no-store"}});
}
