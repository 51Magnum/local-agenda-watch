import { afterEach, expect, it, vi } from "vitest";
import { emailProject, dedupeProjects, projectDiff, isReminderDue } from "./project";
import { announcementTemplate, confirmationTemplate, correctionTemplate, digestTemplates, type EmailLinks } from "./templates";
import { alertReadiness, sendAlertMail, sendDigests } from "../alerts";
import { processRecipients, loadWatchProjects } from "./jobs";
import type { PaneData } from "../maps/project-questions";
import type { Subscription } from "../alerts";
const now=new Date("2026-10-26T14:00:00Z");
const links:EmailLinks={mailingAddress:"123 Example St, Example, ID 00000",unsubscribe:"https://example.test/unsubscribe",manage:"https://example.test/manage"};
const data=():PaneData=>({area:{id:"meridian",name:"City of Meridian",timezone:"America/Denver",planningBody:"Planning & Zoning Commission",decisionBody:"City Council"},item:{id:"H-2026-0053",areaId:"meridian",title:"Thruston Choi Farms Subdivision",type:"SPP",typeLabel:"Preliminary plat",summary:"",stage:"Council/Board",href:"/us/id/meridian/plan/H-2026-0053",geometry:null,centroid:[-116.4,43.6],confidence:"exact",source:"polygon",citywide:false,flumCategories:[],popup:{projectName:"Thruston Choi Farms",headline:"New subdivision proposal",explanation:"A preliminary subdivision plat is proposed.",progress:[]}},where:"Example Road and Sample Avenue",history:[{label:"Filed"}],next:{body:"City Council",startsAt:"2026-10-28T00:00:00Z",location:"City Hall",sourceUrl:"https://official.test/hearing",role:"Decision-making body",commentDeadline:"2026-10-27T18:00:00Z"},impacts:[],conditions:[],caseIds:["H-2026-0053"],documents:[],officialRecords:[{label:"Official record",url:"https://official.test/record"}],calendarHref:"/us/id/meridian/plan/H-2026-0053/hearing.ics",commentUrl:"https://official.test/comments",commentInstructions:"Submit written comments through the official meeting portal.",updatedAt:"2026-10-25"});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("stores previous hearing values and renders an explicit moved-date diff",()=>{
 const before=emailProject(data(),undefined,undefined,now).snapshot,after={...before,next:{...before.next!,startsAt:"2026-12-16T01:00:00Z"}};
 expect(projectDiff(before,after).join(" ")).toMatch(/Hearing moved from.*Oct 27.*Dec 15/);
 expect(before.next?.startsAt).toBe("2026-10-28T00:00:00Z");
 expect(projectDiff(before,{...before,documents:[{label:"Council staff report",url:"https://official.test/report.pdf"}]})).toContain("New staff report posted: Council staff report.");
});
it("deduplicates city/county or alias records by the loader's canonical lead URL",()=>{
 const a=emailProject(data(),undefined,undefined,now),alias={...a,snapshot:{...a.snapshot,areaId:"canyon-county",caseId:"CR2024-0010"}};
 expect(dedupeProjects([a,alias])).toHaveLength(1);
 const message=digestTemplates([a,alias],links)[0];expect((message.html.match(/<section style=/g)||[])).toHaveLength(1);expect(message.subject).not.toMatch(/^2 updates/);
});
it("matches subject counts to actual blocks and uses canonical project links",()=>{
 const a=emailProject(data(),undefined,undefined,now),b={...a,snapshot:{...a.snapshot,key:"https://www.localagendawatch.com/us/id/canyon-county/plan/CR2024-0010",name:"County project"}},c={...a,snapshot:{...a.snapshot,key:"https://www.localagendawatch.com/us/id/nampa/braeburn-creek",name:"Braeburn Creek"}};
 const message=digestTemplates([a,b,c],links,"Home")[0];expect(message.subject).toBe("3 updates near Home: Thruston Choi Farms and 2 more");expect((message.html.match(/<section style=/g)||[])).toHaveLength(3);expect(message.html).not.toContain('/?project=');
 const headings=["What is it?","Where is it?","What’s happened / WHAT CHANGED","What’s next?","How it affects me","How can I act?"];
 let index=-1;for(const heading of headings){const next=message.text.indexOf(heading,index+1);expect(next).toBeGreaterThan(index);index=next;}
 expect(message.text).toContain("Add to calendar (.ics)");expect(message.text).toContain("Official record:");
});
it("scrubs home-occupation names from HTML, plain text, subject, history and images",()=>{
 const d=data();d.area.id="nampa";d.item.id="CUP-00413-2026";d.item.title="Home daycare for Melin";d.item.summary="Melin at 17625 N Onaway Ave";d.item.popup={projectName:"Melin",headline:"Melin daycare",explanation:"Melin requests a permit",progress:[]};d.where="17625 N Onaway Ave";d.history=[{label:"Melin report posted"}];d.documents=[{label:"Melin application",url:"https://official.test/melin.pdf"}];
 const p=emailProject(d,undefined,undefined,now),message=digestTemplates([p],links)[0];
 expect(JSON.stringify(message)).not.toMatch(/Melin|17625/i);expect(message.subject).toContain("Home daycare permit");expect(message.text).toContain("17600 block of N Onaway Ave");expect(message.html).not.toContain("<img");
});
it("never presents a withdrawn case as upcoming and includes known status dates",()=>{
 const d=data();d.item.recordStatus="WithDrawn";d.item.decisionDate="2026-06-23";const p=emailProject(d,undefined,undefined,now);
 expect(p.snapshot.next).toBeUndefined();expect(isReminderDue(p,now)).toBe(false);const message=digestTemplates([p],links)[0];expect(message.text).toContain("Withdrawn Jun 23, 2026");expect(message.text).not.toContain("Add to calendar");
 d.item.recordStatus="Approved";d.item.stage="Decided";expect(digestTemplates([emailProject(d,undefined,undefined,now)],links)[0].text).toContain("Approved Jun 23, 2026");
});
it("closes a passed timed deadline rather than inviting a late submission",()=>{
 const d=data();d.next!.commentDeadline="2026-10-26T12:00:00Z";const message=digestTemplates([emailProject(d,undefined,undefined,now)],links,undefined,false,now)[0];
 // Renderer uses the current clock, including times within today's date.
 expect(message.text).toContain("deadline has passed");expect(message.text).not.toContain("Comment information:");
});
it("requires exactly two local calendar days for a reminder",()=>{
 const d=data();d.next!.startsAt="2026-10-29T00:00:00Z";const p=emailProject(d,undefined,undefined,now);expect(isReminderDue(p,now)).toBe(true);expect(isReminderDue(p,new Date("2026-10-27T14:00:00Z"))).toBe(false);
});
it("does not invite comments for a cached hearing whose date has passed",()=>{
 const d=data();d.next!.startsAt="2026-10-20T00:00:00Z";const message=digestTemplates([emailProject(d,undefined,undefined,now)],links,undefined,false,now)[0];expect(message.text).toContain("The listed hearing has passed");expect(message.text).not.toContain("Comment information:");expect(message.text).not.toContain("Add to calendar");expect(message.text).not.toContain("The case is closed");
});
it("renders all template families with HTML, text, preheader, footer, and bounded size",()=>{
 const p=emailProject(data(),undefined,undefined,now);
 const messages=[confirmationTemplate({kind:"project",areaId:"meridian",caseId:"H-2026-0053"},"https://example.test/confirm",links,p),confirmationTemplate({kind:"place",label:"Home",coordinates:[-116.4,43.6],radiusMiles:1},"https://example.test/confirm",links),confirmationTemplate({kind:"pending",label:"Example area"},"https://example.test/confirm",links),...digestTemplates([p],links),...digestTemplates([p],links,undefined,true),announcementTemplate({name:"Example area",url:"https://example.test/area"},links,[p]),correctionTemplate({id:"example",message:"Check the hearing date.",project:p},links)];
 for(const m of messages){expect(m.html).toContain("max-width:600px");expect(m.html).toContain("prefers-color-scheme:dark");expect(m.preheader.length).toBeGreaterThan(10);expect(m.text).not.toContain("Manage watches:");expect(m.html).not.toContain("Manage watches");expect(m.text).toContain("Unsubscribe from all alerts:");expect(m.text).toContain("Updated automatically from public records");expect(Buffer.byteLength(m.html+m.text)).toBeLessThan(100000);}
 expect(messages[0].text).toContain("Thruston Choi Farms");expect(messages[1].text).toContain("within 1 mile of Home");expect(messages[2].text).toContain("choose a project or address");
 expect(messages[0].html).toContain("v:roundrect");expect(messages[0].html).toContain("height:50px;v-text-anchor:middle");
});
it("sends every oversized digest part on the same run without dropping blocks",()=>{
 const p=emailProject(data(),undefined,undefined,now);const projects=Array.from({length:80},(_,i)=>({...p,snapshot:{...p.snapshot,key:p.snapshot.key+"-"+i,name:"Project "+i}}));const messages=digestTemplates(projects,links,"Home");expect(messages.length).toBeGreaterThan(1);expect(messages.reduce((n,m)=>n+(m.html.match(/<section style=/g)||[]).length,0)).toBe(80);for(const m of messages)expect(Buffer.byteLength(m.html+m.text)).toBeLessThan(100000);
});
it("continues to the next recipient after one person's failure",async()=>{
 const seen:string[]=[];expect(await processRecipients(["one","two","three"],async recipient=>{seen.push(recipient);if(recipient==="two")throw Error("failure");})).toEqual({completed:2,failed:1});expect(seen).toEqual(["one","two","three"]);
});
it("uses the pane loader for project aliases and stores only one canonical snapshot",async()=>{
 const d=data(),load=vi.fn().mockResolvedValue(d),sub={id:"one",target:{kind:"place",label:"Home",coordinates:[-116.4,43.6],radiusMiles:5},state:null} as Subscription;
 const square={type:"Polygon",coordinates:[[[-116.41,43.59],[-116.39,43.59],[-116.39,43.61],[-116.41,43.61],[-116.41,43.59]]]} as const;
 const rows=[{id:"H-2026-0053",areaId:"meridian",geometry:square},{id:"ALIAS",areaId:"canyon-county",geometry:square}] as unknown as Parameters<typeof loadWatchProjects>[1];const result=await loadWatchProjects(sub,rows,load,now);expect(load).toHaveBeenCalledTimes(2);expect(result).toHaveLength(1);expect(result[0].snapshot.key).toContain("/us/id/meridian/plan/H-2026-0053");
});
it("blocks live mail before approval even with credentials and blocks preview live mail even with a true flag",async()=>{
 const fetch=vi.fn();vi.stubGlobal("fetch",fetch);vi.stubEnv("RESEND_API_KEY","configured");vi.stubEnv("ALERTS_MAILING_ADDRESS","123 Example St");vi.stubEnv("ALERTS_DELIVERY_ENABLED","false");vi.stubEnv("VERCEL_ENV","production");expect(alertReadiness().deliveryEnabled).toBe(false);expect((await sendDigests()).sent).toBe(0);await expect(sendAlertMail({to:"person@example.test",subject:"test",html:"<p>test</p>",text:"test",key:"test",unsubscribe:"https://example.test/remove"})).rejects.toThrow("paused");vi.stubEnv("ALERTS_DELIVERY_ENABLED","true");vi.stubEnv("VERCEL_ENV","preview");expect(alertReadiness().deliveryEnabled).toBe(false);expect(fetch).not.toHaveBeenCalled();
});
it("fails readiness on an empty mailing address",()=>{vi.stubEnv("RESEND_API_KEY","configured");vi.stubEnv("ALERTS_MAILING_ADDRESS","  ");expect(alertReadiness().ready).toBe(false);});
