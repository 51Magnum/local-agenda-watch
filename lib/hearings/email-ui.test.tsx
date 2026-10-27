import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HearingNext from "../../app/components/maps/hearing-next";
import { braeburnCreek } from "../projects";
import { enrichHearing, NAMPA_PORTAL } from "./policies";
import { emailProject, snapshotFingerprint, projectDiff } from "../email/project";
import { digestTemplates } from "../email/templates";
import type { PaneData } from "../maps/project-questions";
const now=new Date("2026-10-26T18:00:00Z");
const hearing=()=>({...enrichHearing("nampa",braeburnCreek.nextHearing!),role:"Decision-making body"});
const data=():PaneData=>({area:{id:"nampa",name:"City of Nampa",timezone:"America/Denver",planningBody:"P&Z",decisionBody:"City Council"},item:{id:"ANN-00371-2026",title:"Braeburn Creek",href:"/us/id/nampa/braeburn-creek",type:"ANN",typeLabel:"Annexation",summary:"",stage:"Council/Board",geometry:null,centroid:null,source:"none",confidence:"approximate",citywide:false,flumCategories:[],popup:{projectName:"Braeburn Creek",headline:"487 new homes on 138 acres",progress:[]}},history:[],impacts:[],conditions:[],next:hearing(),caseIds:braeburnCreek.caseIds,updatedAt:"2026-10-26"});
const links={mailingAddress:"Example mailing address",unsubscribe:"https://example.test/unsubscribe",manage:"https://example.test/manage"};
it("renders the exact Braeburn body, hearing time, sourced deadlines and portal fallback",()=>{
 const html=renderToStaticMarkup(<HearingNext next={hearing()} timezone="America/Denver"/>);
 expect(html).toContain("Nampa City Council");expect(html).toContain("Mon, Nov 2, 2026");expect(html).toContain("6 PM Mountain Time");expect(html).toContain("Meeting portal");expect(html).toContain(NAMPA_PORTAL);expect(html).toContain("Thu, Oct 29, 2026");
 expect(html).toContain("Wed, Oct 28, 2026");expect(html).toContain("12 PM Mountain Time");expect(html).toContain("PZall@cityofnampa.us");expect(html).toContain("Deadline source");
 expect(html).not.toContain("Agenda item undefined");
});
it("switches to the matched meeting and packet, shows an item number, and hides unsourced deadlines",()=>{
 const next={...hearing(),meeting_url:"https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10",agenda_url:"https://nampa.primegov.com/Public/CompiledDocument?meetingTemplateId=10&compileOutputType=1",packet_url:"https://nampa.primegov.com/packet",agenda_item_number:"9.A",match_status:"published" as const,commentSourceUrl:undefined,comment_deadline_source_url:undefined,staff_report_deadline_source_url:undefined};
 const html=renderToStaticMarkup(<HearingNext next={next} timezone="America/Denver"/>);
 expect(html).toContain("View meeting agenda");expect(html).toContain("Staff report / packet");expect(html).toContain("Agenda item 9.A");expect(html).not.toContain("Deadline source");expect(html).not.toContain("Agenda expected");
});
it("includes the same meeting navigation and sourced deadlines in HTML and text digests within fourteen days",()=>{
 const d=data();const message=digestTemplates([emailProject(d,undefined,undefined,now)],links,undefined,false,now)[0];
 for(const body of [message.html,message.text]){expect(body).toContain("Meeting portal");expect(body).toContain(NAMPA_PORTAL);expect(body).toContain("Comments included in staff report");expect(body).toContain("Deadline source");}
 expect(message.html).toContain("Nampa City Council");
 const early=new Date("2026-10-01T18:00:00Z");expect(digestTemplates([emailProject(d,undefined,undefined,early)],links,undefined,false,early)[0].html).not.toContain("Meeting portal");
});
it("does not turn a routine meeting-link check or an equivalent timestamp format into a false project change",()=>{
 const d=data();d.next!.last_checked_at=now.toISOString();const before=emailProject(d,undefined,undefined,now).snapshot;d.next!.last_checked_at="2026-10-27T18:00:00Z";
 expect(snapshotFingerprint(emailProject(d,undefined,undefined,now).snapshot)).toBe(snapshotFingerprint(before));
 expect(projectDiff(before,{...before,next:{...before.next!,startsAt:new Date(before.next!.startsAt).toISOString()}})).not.toEqual(expect.arrayContaining([expect.stringContaining("Hearing moved")]));
 expect(projectDiff(before,{...before,next:{...before.next!,agendaUrl:"https://nampa.primegov.com/agenda"}})).toContain("Official meeting agenda posted or updated.");
});
