export type AdminSection={id:string;label:string;description:string;links:{href:string;label:string}[]};
export const ADMIN_SECTIONS:AdminSection[]=[
 {id:"content",label:"Content & Review",description:"Check project wording, evidence and source health. Use this when a summary or hearing needs verification.",links:[{href:"/admin/review",label:"Evidence & exceptions"},{href:"/admin/content",label:"Project content"},{href:"/admin/sweep",label:"Source sweep"}]},
 {id:"images",label:"Images",description:"Review candidate pages, privacy checks and crops. Use this when a project preview needs attention.",links:[{href:"/admin/images",label:"Image review & cropping"}]},
 {id:"jurisdictions",label:"Jurisdictions",description:"Inspect staged counties and cities, source checks and launch reports. Use this when adding or checking coverage.",links:[{href:"/admin/jurisdictions",label:"Jurisdiction onboarding"}]},
 {id:"residents",label:"Residents & Plans",description:"Find resident accounts and confirm plan changes. Use this for private pin and plan support.",links:[{href:"/admin/residents",label:"Resident accounts & plans"}]},
 {id:"emails",label:"Alerts & Emails",description:"Inspect delivery settings, template previews and signup requests. Use this before an explicitly approved email action.",links:[{href:"/admin/alerts",label:"Alert settings"},{href:"/admin/emails",label:"Email previews & tests"},{href:"/admin/signups",label:"Signups & coverage requests"}]},
 {id:"corrections",label:"Corrections",description:"Read resident reports and mark follow-up complete. Use this when someone flags a possible error.",links:[{href:"/admin/corrections",label:"Correction reports"}]},
 {id:"privacy",label:"Privacy & Audits",description:"Review residential protection overrides and recorded changes. Use this before changing what personal information can appear.",links:[{href:"/admin/privacy",label:"Residential privacy"},{href:"/admin/audits",label:"Audit history"}]},
];
export function adminPage(path:string){
 const link=ADMIN_SECTIONS.flatMap(s=>s.links).filter(l=>path===l.href||path.startsWith(l.href+"/")).sort((a,b)=>b.href.length-a.href.length)[0];
 const section=ADMIN_SECTIONS.find(s=>s.links.some(l=>l.href===link?.href));
 return {link,section};
}
export function adminPageIntro(path:string){
 if(path.startsWith("/admin/images/crop/"))return "Choose a preview from the full approved source page. Save or reset only after reviewing the crop; a fresh personal-information check must pass before the preview is shown publicly.";
 if(path.startsWith("/admin/images/"))return "Review this case’s candidate pages and scan status. Select an approved preview, hide an unsuitable image, or open Crop to improve its framing.";
 const intros:Record<string,string>={
  "/admin/review":"Review evidence, hearing links and jurisdiction exceptions. Open the official source before approving, fixing, rejecting or hiding a record.",
  "/admin/content":"Find unclear project titles and run the existing content backfill when official records need a clearer resident summary.",
  "/admin/sweep":"Check source feeds and resume discovery or extraction. Use a forced sweep when the displayed source health needs a fresh check.",
  "/admin/images":"Inspect displayed images, withheld candidates and scan jobs. Open a case to select, hide or crop an approved source page.",
  "/admin/jurisdictions":"Inspect staged jurisdictions, reports and source checks. Use the existing onboarding operations to diagnose coverage and publication readiness.",
  "/admin/residents":"Search resident emails and inspect private pin status. Plan changes use the existing separate confirmation screen and audit record.",
  "/admin/alerts":"Inspect alert configuration and confirmed or stopped watches. Waitlist delivery still requires its existing owner approval.",
  "/admin/emails":"Preview templates at phone or desktop size. Send an explicit test only to the address you enter; approved campaigns retain their existing gates.",
  "/admin/signups":"Read private alert-interest and coverage requests. Filter or page through submissions; reading this list does not activate alerts.",
  "/admin/corrections":"Read reported errors, check the official record, and mark follow-up resolved or reopen it when more work is needed.",
  "/admin/privacy":"Inspect residential protections and source-checked overrides. Change a policy only after verifying the official record.",
  "/admin/audits":"Read recent review decisions and plan changes. Follow the record link for details; no changes are made from this history view.",
 };
 return intros[adminPage(path).link?.href??""]??"Choose a section below to review its records, attention counts and existing operations.";
}
/** Route-handler confirmation documents cannot use a Next layout; use the same menu data. */
export function adminNavigationHtml(path:string){
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
 const active=adminPage(path).link?.href;
 return `<details><summary>Admin menu</summary><nav aria-label="Admin navigation"><a href="/admin">Overview &amp; health</a>${ADMIN_SECTIONS.map(section=>`<section style="margin:12px 0"><strong>${escape(section.label)}</strong>${section.links.map(link=>`<a style="display:block;padding:6px 0" href="${escape(link.href)}"${link.href===active?' aria-current="page"':""}>${escape(link.label)}</a>`).join("")}</section>`).join("")}</nav></details>`;
}
const decode=(s:string)=>{try{return decodeURIComponent(s);}catch{return s;}};
const human=(s:string)=>decode(s).replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase());
export function adminBreadcrumbs(path:string):{label:string;href?:string}[]{
 const crumbs:{label:string;href?:string}[]=[{label:"Admin",...path!=="/admin"?{href:"/admin"}:{}}];
 if(path==="/admin")return crumbs;
 const {link}=adminPage(path);if(!link)return [...crumbs,{label:"Admin page"}];
 crumbs.push({label:link.label,...path!==link.href?{href:link.href}:{}});
 const tail=path.slice(link.href.length).split("/").filter(Boolean);
 if(link.href==="/admin/images"&&tail[0]==="crop")return [...crumbs,{label:"Crop image"}];
 if(link.href==="/admin/images"&&tail.length>=2)return [...crumbs,{label:human(tail[0]),href:"/admin/images?area="+encodeURIComponent(tail[0])},{label:decode(tail[1])}];
 if(link.href==="/admin/jurisdictions"&&tail.length)return [...crumbs,{label:human(tail[0]),href:"/admin/jurisdictions#review-"+encodeURIComponent(tail[0])},...tail.length>2?[{label:decode(tail[tail.length-1])}]:[]];
 if(link.href==="/admin/residents"&&tail.length)return [...crumbs,{label:"Account details"}];
 return tail.length?[...crumbs,{label:human(tail[tail.length-1])}]:crumbs;
}
export function adminActionHelp(label:string,post=false):{description:string;confirm:boolean}{
 const text=label.trim().toLowerCase();
 const rules:[RegExp,string,boolean][]=[
  [/reset to auto crop/,"Rebuild the automatic preview from the original approved page and check its privacy again.",true],
  [/save crop/,"Publish this selected crop only after its new personal-information check passes.",true],
  [/remove.*image|replace.*image|review image from selected document/,"Update this staged image using the existing source and privacy review rules.",true],
  [/^crop(?:\s|$)/,"Open the source-page editor; cropping requires a privacy-approved document page.",false],
  [/preview|desktop|mobile|dark|plain text/,"Change the preview or open its editor without changing stored records.",false],
  [/review plan change/,"Open the existing confirmation step; the resident plan is not changed yet.",false],
  [/confirm plan change/,"Apply the reviewed plan and record its existing private audit entry.",false],
  [/search|filter|pending|^done|select all|^clear$|previous|next page|cancel|close|dismiss/,"Change the displayed results or selection without editing records.",false],
  [/purge/,"Remove unchecked image assets and run the existing privacy audit; approved source pages are retained.",true],
  [/hide/,"Change image visibility; only images passing the existing privacy gate can be shown.",true],
  [/^select$/, "Use this privacy-approved image as the case's selected preview.",true],
  [/use map/,"Select a GIS context map for this case; it is labelled as a location map, not a proposed design.",true],
  [/rescan|scan next/,"Queue or scan source documents using existing limits and save image-review results.",true],
  [/approve|apply fix|reject/,"Record the review decision for the selected evidence or exception; public eligibility follows existing checks.",true],
  [/undo/,"Restore the previous values for that recorded review batch.",true],
  [/resume.*publication/,"Resume public display only after the current self-check, recorded approval and reviewed snapshot match.",true],
  [/pause/,"Pause publication for this jurisdiction using the existing publication switch.",true],
  [/mark resolved|reopen/,"Update this correction report's follow-up status.",true],
  [/send|waitlist/,"Send the described email only through the existing delivery and owner-approval gates.",true],
  [/backfill|sweep/,"Run the existing collection job and save results within its current budget and privacy limits.",true],
  [/sample-ai/,"Run the existing bounded AI sample and save its results; existing budget caps apply.",true],
  [/validate|runtime-check|qa-report/,"Run the existing source or QA check and save its report where that operation already does so.",true],
  [/retry/,"Queue the failed work for another attempt using the existing retry limits.",true],
  [/save|protect|policy/,"Save the changes shown in this form using the existing validation rules.",true],
 ];
 const rule=rules.find(([pattern])=>pattern.test(text));return rule?{description:rule[1],confirm:rule[2]}:{description:post?"Submit the changes shown in this form.":"Change the displayed view without editing records.",confirm:post};
}
