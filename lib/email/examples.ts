import type { PaneData } from "../maps/project-questions";
import { emailProject, type WatchTarget } from "./project";
import { announcementTemplate, confirmationTemplate, correctionTemplate, digestTemplates, type RenderedEmail, type EmailLinks } from "./templates";
import { SITE_ORIGIN } from "../site-config";
import { distance } from "@turf/turf";
export type EmailExample={id:string;label:string;description:string;message:RenderedEmail};
export async function loadEmailExamples():Promise<EmailExample[]>{
 const requested=[["nampa","ANN-00371-2026"],["meridian","H-2026-0053"],["canyon-county","CR2024-0010"]];
 const data=await Promise.all(requested.map(async([area,id])=>{
  // Preview databases can be isolated snapshots with different cached assets.
  // Use the live pane endpoint (which calls the same projectDetail loader) for
  // real-current review facts and publicly accessible image URLs.
  let value:PaneData|null=null;
  const response=await fetch(SITE_ORIGIN+"/api/map/project?"+new URLSearchParams({area,case:id}),{cache:"no-store",signal:AbortSignal.timeout(20000)});if(response.ok)value=await response.json();
  if(!value)throw Error("Current project data unavailable for "+area+"/"+id);
  return value;
 }));
 const centers=data.flatMap(d=>d.item.centroid?[d.item.centroid]:[]);
 const coordinates:[number,number]=[centers.reduce((n,c)=>n+c[0],0)/centers.length,centers.reduce((n,c)=>n+c[1],0)/centers.length];
 const radius=Math.ceil(Math.max(...centers.map(c=>distance(coordinates,c,{units:"miles"})))+.1);
 if(!centers.length||radius>10)throw Error("Example projects do not fit within a supported address radius");
 const place:Extract<WatchTarget,{kind:"place"}>={kind:"place",label:"Home",coordinates,radiusMiles:Math.max(1,radius)};
 const projects=data.map(d=>emailProject(d,undefined,place));
 const projectOnly=projects.map(p=>({...p,distance:undefined}));
 const links:EmailLinks={mailingAddress:process.env.ALERTS_MAILING_ADDRESS?.trim()||"Mailing address not configured — preview only",unsubscribe:SITE_ORIGIN+"/api/alerts/unsubscribe?token=preview-inactive",manage:SITE_ORIGIN+"/api/alerts/manage?token=preview-inactive",test:true};
 const confirm=SITE_ORIGIN+"/api/alerts/confirm?token=preview-inactive";
 return [
  {id:"confirmation-project",label:"Confirmation · project watch",description:"Current Braeburn Creek data, named project, canonical project link, and explicit confirmation steps.",message:confirmationTemplate({kind:"project",areaId:"nampa",caseId:"ANN-00371-2026"},confirm,links,projectOnly[0])},
  {id:"confirmation-address",label:"Confirmation · address watch",description:`An illustrative saved place and ${place.radiusMiles}-mile radius; no real subscriber location is used.`,message:confirmationTemplate(place,confirm,links)},
  {id:"waitlist-reconsent",label:"Confirmation · waitlist re-consent",description:"An interest-list entry without a project or place is not automatically activated.",message:confirmationTemplate({kind:"pending",label:"Nampa"},confirm,links)},
  {id:"digest-project",label:"Daily digest · project watch",description:"Current Braeburn Creek record, not a fabricated new change.",message:digestTemplates([{...projects[0],distance:undefined}],links)[0]},
  {id:"digest-address",label:"Daily digest · address watch",description:"Current CR2024-0010 record and measured distance from the illustrative saved place.",message:digestTemplates([projects[2]],links,place.label)[0]},
  {id:"digest-multiple",label:"Daily digest · multiple projects",description:"Braeburn Creek, Thruston Choi, and CR2024-0010 using their current public pane data.",message:digestTemplates(projects,links,place.label)[0]},
  {id:"hearing-reminder",label:"Hearing reminder",description:"Current Thruston Choi hearing. This is a timing-neutral preview; live delivery requires the hearing to be exactly two local calendar days away.",message:digestTemplates([projectOnly[1]],links,undefined,true)[0]},
  {id:"announcement",label:"Announcement · new coverage",description:"Layout example using the current Meridian coverage record. This is not a claim that coverage launched today. Admin trigger and separate coverage opt-in are required.",message:announcementTemplate({name:"Meridian",url:SITE_ORIGIN+"/us/id/meridian"},links,[projectOnly[1]])},
  {id:"correction-received",label:"Correction received · internal inbox",description:"Illustrative report against the real Braeburn project. No resident reports or contact details are exposed.",message:correctionTemplate({id:"PREVIEW-ONLY",message:"Illustrative report: please verify the hearing information against the official notice. This is not an actual correction request.",project:projectOnly[0]},links)},
 ];
}
