import { mergeMeetingIndex, emptySchedule } from "../timeline/schedule";
import { indexScheduledMeetings } from "../localities/nampa";
import { expect, it, vi } from "vitest";
import { alertFixture, hearingFixture } from "../../tests/fixtures/alert-regressions";
import { continuationDate, scheduledContinuations } from "../continuances";
import { braeburnCreek, getProjectNextHearing } from "../projects";
import { getCaseNextHearing } from "../case-details";
import { withRelatedHearings } from "../related-hearings";
import { normalizeCaseState } from "../case-state";
import { alertSourceVersion, emailProject, projectDiff, rankProjects } from "./project";
import { digestTemplates } from "./templates";
import { previewWatch } from "./dry-run";
import { checkOfficialLink, createLinkChecker, verifyProjectLinks } from "./links";
import { buildPopupModel } from "../maps/popup-model";
import { AREAS } from "../areas/registry";
import { projectDensity, residentialOnly } from "../project-overview";
import { loadWatchProjects } from "./jobs";
import { caseSpecificRecordUrl } from "../maps/project-records";
import type { Subscription } from "../alerts";
const now=new Date("2026-11-10T19:00:00Z");
const links={mailingAddress:"Synthetic preview",unsubscribe:"https://preview.invalid/remove",manage:"https://preview.invalid/manage"};
const render=(d=alertFixture(),at=now)=>digestTemplates([emailProject(d,undefined,undefined,at)],links,undefined,false,at)[0];

it("promotes Braeburn's explicit continuation to January 4 without copying the old time or agenda",()=>{
  const meeting={date:"2026-11-02",dateLabel:"Nov 2",body:"City Council",bodyLabel:"City Council",time:"18:00",agendaUrl:"https://official.example.test/old-agenda",sourceUrl:"https://official.example.test/notice",commentDeadline:"2026-11-02",continuedNote:"Continued to 1/4/27 per applicant request"};
  const feed={active:[hearingFixture("ANN-00371-2026",{meetings:[meeting]})],completed:[]};
  const next=getProjectNextHearing(braeburnCreek,feed,now);
  expect(next).toMatchObject({startsAt:"2027-01-04",continuationFrom:"2026-11-02",sourceUrl:meeting.sourceUrl});
  expect(next?.agendaUrl).toBeUndefined();expect(next?.commentDeadline).toBeUndefined();
  const popup=buildPopupModel({...alertFixture().item,id:"ANN-00371-2026",uses:["homes"]},AREAS.nampa,feed.active[0],[],now);
  expect(popup.progress.some(p=>/Jan 4/.test(p.label))).toBe(true);expect(JSON.stringify(popup)).not.toContain("no hearing set yet");
  const d=alertFixture("Braeburn Creek","ANN-00371-2026","nampa");d.next={...next!,role:"Decision-making body"};
  expect(render(d).text).toContain("Jan 4, 2027");expect(render(d).text).not.toContain("No upcoming hearing");
});
it.each(["1/4/27","2027-01-04","January 4, 2027","1/4"])("parses explicit continuation format %s with year rollover",target=>expect(continuationDate("Continued to "+target,"2026-11-02")).toBe("2027-01-04"));
it("rejects invalid dates and requested continuances; keeps later continuations authoritative",()=>{
  expect(continuationDate("Continued to 2/30/27","2026-11-02")).toBeUndefined();
  expect(continuationDate("Applicant requested continuance to 1/4/27","2026-11-02")).toBeUndefined();
  expect(continuationDate("Continued from 10/1/26","2026-11-02")).toBeUndefined();
  const a={body:"City Council",bodyLabel:"Council",date:"2026-11-02",dateLabel:"Nov 2",sourceUrl:"https://official.example.test/notice",continuedNote:"Continued to 1/4/27"};
  const result=scheduledContinuations([a,{...a,date:"2027-01-04",continuedNote:"Continued to 2/1/27"}]);
  expect(result.filter(m=>!m.continuedNote).map(m=>m.date)).toEqual(["2027-02-01"]);
});
it("finds Nineteenth's hearing through explicit PP/PPUD child cases; does not join names",()=>{
  const a=hearingFixture("NINETEENTH",{relatedCaseIds:["PP-2026-06","PPUD-2026-06"]});
  const b=hearingFixture("PP-2026-06"),c=hearingFixture("PPUD-2026-06",{meetings:[{date:"2026-11-02",dateLabel:"Nov 2",body:"P&Z",bodyLabel:"Planning & Zoning Commission",sourceUrl:"https://official.example.test/notice",continuedNote:null}]});
  const feed={active:[a,b,c],completed:[]},at=new Date("2026-11-01T19:00:00Z");
  expect(getCaseNextHearing(a,feed,at,"eagle")?.startsAt).toBe("2026-11-02");
  expect(withRelatedHearings(a,feed).relatedCaseIds).toContain("PPUD-2026-06");
  expect(getCaseNextHearing(hearingFixture("UNRELATED"),feed,at,"eagle")).toBeUndefined();
  expect(getCaseNextHearing(a,feed,now,"eagle")).toBeUndefined();
});
it("suppresses Momentum's expired speaking/exhibit copy, density, and internal headings in HTML and text",()=>{
  const message=render();
  for(const content of [message.html,message.text]) {
    expect(content).not.toMatch(/sign up to speak|submit exhibits|homes\/acre|Decision-making body/i);
    expect(content).not.toContain("WHAT CHANGED");
    expect(content).toContain("H-2026-0036");expect(content).toContain("Subdivision with 11 Residential and 24 Commercial Lots on 106.1 Acres");
    expect(content).toContain("Northeast corner");expect(content).toContain("hearing has passed");
  }
  expect(emailProject(alertFixture(),undefined,undefined,now).snapshot.normalizedStatus).toBe("hearing_passed_decision_pending");
  expect(projectDensity({variant:"mixed-use",homes:{value:"11",url:"https://official.example.test/report"},acres:{value:"106.1",url:"https://official.example.test/report"}})).toBeUndefined();
  expect(residentialOnly(alertFixture().item.summary,["homes","business"])).toBe(false);
});
it("does not describe approved Elite Industrial as being considered or invite participation",()=>{
  const d=alertFixture("Elite Industrial","CMA-00067-2026","nampa");d.item.recordStatus="Approved";d.item.stage="Decided";d.item.popup!.explanation="A planning application request is being considered.";
  const message=render(d);
  expect(emailProject(d,undefined,undefined,now).snapshot.normalizedStatus).toBe("approved");
  expect(message.text).toContain("Approved");expect(message.html+message.text).not.toMatch(/being considered|sign up to speak/i);
});
it.each([["Pending","2026-11-12",undefined,"upcoming_hearing"],["Approved",undefined,undefined,"approved"],["Denied",undefined,undefined,"denied"],["Withdrawn",undefined,undefined,"withdrawn"],["Closed",undefined,undefined,"closed"],["Pending",undefined,undefined,"under_review"]])("normalizes %s reliably",(status,next,last,expected)=>expect(normalizeCaseState(status!,next,last,now)).toBe(expected));
it("uses Denver calendar days through DST and UTC midnight",()=>{
  expect(normalizeCaseState("Pending","2026-11-01",undefined,new Date("2026-11-02T05:00:00Z"))).toBe("upcoming_hearing");
  expect(normalizeCaseState("Pending",undefined,"2026-11-01",new Date("2026-11-02T08:00:00Z"))).toBe("hearing_passed_decision_pending");
});
it.each([["Public Storage","CUP-2000-20-MOD1"],["Eagle & Idaho","RZDA-2024-01"]])("renders %s's complete official case number in the block and comment reference",(name,id)=>{
  const message=render(alertFixture(name,id,"eagle"));
  expect(message.text).toContain("Case: "+id);expect(message.text).toContain("Reference case "+id);expect(message.html).toContain(id);
});
it("baselines historical closed cases and new watches, and ranks actionable projects over old decisions",async()=>{
  const d=alertFixture("Old closed plat","H-2025-0001");d.item.recordStatus="Closed";d.item.stage="Decided";d.next=undefined;
  const sub={id:"synthetic",email:"preview@example.invalid",unsubscribe_token:"inactive",target:{kind:"project",areaId:"meridian",caseId:d.item.id},state:{version:2,projects:{}}} as Subscription;
  const load=vi.fn().mockResolvedValue(d);
  expect((await loadWatchProjects(sub,[],load,now))[0].changes).toEqual([]);
  const active=alertFixture();active.next!.startsAt="2026-11-12";const a=emailProject(active,undefined,undefined,now),closed=emailProject(d,undefined,undefined,now);
  expect(rankProjects([closed,a],now)[0]).toBe(a);expect(digestTemplates([closed,a],links,undefined,false,now)[0].subject).toContain("Momentum Subdivision");
  const fresh={...sub,state:null};expect((await loadWatchProjects(fresh,[],load,now))[0].changes).toEqual([]);
});
it("does not alert on cosmetic copy or a hearing aging out, but detects each material event",()=>{
  const d=alertFixture(),before=emailProject(d,undefined,undefined,new Date("2026-11-01T19:00:00Z")).snapshot;
  expect(projectDiff(before,{...before,headline:"Clearer wording",where:"New wording",commentUrl:"https://official.example.test/new-comments",history:["Different prose"],next:undefined},now)).toEqual([]);
  expect(projectDiff(before,{...before,next:{...before.next!,startsAt:"2027-01-04"}},now).join(" ")).toMatch(/moved/);
  expect(projectDiff(before,{...before,status:"Denied"},now).join(" ")).toMatch(/Denied/);
  expect(projectDiff(before,{...before,next:{...before.next!,deadline:"2026-11-12"}},now).join(" ")).toMatch(/Comment deadline updated/);
  expect(projectDiff(before,{...before,documents:[{label:"Report",url:"https://official.example.test/new.pdf"}]},now).join(" ")).toMatch(/New official document/);
});
it("never exposes Test1 in distance copy, preheader, subject or footer",()=>{
  const d=alertFixture(),p=emailProject(d,undefined,{kind:"place",label:"Test1",coordinates:[-116.4,43.56],radiusMiles:1},now);
  const message=digestTemplates([p],links,"Test1",false,now)[0];expect(JSON.stringify(message)).not.toContain("Test1");expect(message.text).toContain("your saved place");
});
it("follows Eagle redirects with TLS checks and omits bad links from both MIME parts",async()=>{
  const original="https://eagle.example.test/AgendaViewer.php?view_id=1",redirect="https://broken.example.test/agenda.pdf";
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:302,headers:{location:redirect}})).mockRejectedValueOnce(Object.assign(new Error("mismatch"),{cause:{code:"ERR_TLS_CERT_ALTNAME_INVALID"}}));
  expect(await checkOfficialLink(original,fetcher,async()=>true)).toEqual({ok:false,reason:"TLS certificate error"});
  expect(fetcher.mock.calls[1][0]).toBe(redirect);
  const d=alertFixture("Eagle & Idaho","RZDA-2024-01","eagle");d.officialRecords=[{label:"Official case",url:original}];d.next!.startsAt="2026-11-12";d.next!.agendaUrl=original;
  const p=await verifyProjectLinks(emailProject(d,undefined,undefined,now),async url=>url===original?{ok:false,reason:"TLS certificate error"}:{ok:true,url});
  const message=digestTemplates([p],links,undefined,false,now)[0];expect(message.html+message.text).not.toContain(original);
  expect(caseSpecificRecordUrl("https://experience.arcgis.com/experience/example",["RZDA-2024-01"])).toBeUndefined();
  expect(caseSpecificRecordUrl("https://nampa.primegov.com/public/portal",["CMA-00067-2026"])).toBeUndefined();
});
it("flags HTTP errors and redirect loops; caches only within one build",async()=>{
  expect((await checkOfficialLink("https://official.example.test/missing",vi.fn().mockResolvedValue(new Response(null,{status:404})),async()=>true)).reason).toBe("HTTP 404");
  const request=vi.fn().mockResolvedValue(new Response(null,{status:302,headers:{location:"/loop"}}));expect((await checkOfficialLink("https://official.example.test/loop",request,async()=>true)).ok).toBe(false);expect(request).toHaveBeenCalledTimes(6);
  const check=vi.fn().mockResolvedValue({ok:true}),cached=createLinkChecker(check);await Promise.all([cached("one"),cached("one")]);expect(check).toHaveBeenCalledTimes(1);
  const redirect=vi.fn().mockResolvedValue(new Response(null,{status:302,headers:{location:"https://127.0.0.1/private"}}));expect((await checkOfficialLink("https://official.example.test/redirect",redirect,async host=>host!=="127.0.0.1")).ok).toBe(false);expect(redirect).toHaveBeenCalledTimes(1);
});
it("dry-runs a watch without sending or mutating its baseline; reports exact inclusion reasons and link checks",async()=>{
  const d=alertFixture(),old=emailProject(d,undefined,undefined,new Date("2026-11-01T19:00:00Z")).snapshot;
  d.next!.startsAt="2027-01-04";const sub={id:"synthetic",email:"preview@example.invalid",unsubscribe_token:"inactive",target:{kind:"project",areaId:"meridian",caseId:d.item.id},state:{version:2,projects:{[old.key]:old}}} as Subscription;
  const baseline=JSON.stringify(sub.state),check=vi.fn().mockImplementation(async url=>({ok:true,url}));
  const preview=await previewWatch(sub,[],now,vi.fn().mockResolvedValue(d),check);
  expect(JSON.stringify(sub.state)).toBe(baseline);expect(preview.report[0]).toMatchObject({caseNumber:"H-2026-0036",status:"upcoming_hearing",nextHearing:"2027-01-04",included:true});
  expect(preview.report[0].reason.join(" ")).toMatch(/moved/);expect(preview.report[0].linkChecks).toBeDefined();expect(preview.messages).toHaveLength(1);expect(preview.messages[0].text).toContain("TEST / PREVIEW");
});

it("baselines newly added sources and legacy discovery state instead of emailing historical imports",async()=>{
  const d=alertFixture(),sub={id:"synthetic",email:"preview@example.invalid",unsubscribe_token:"inactive",target:{kind:"project",areaId:"meridian",caseId:d.item.id},state:{version:2,sourceVersions:{meridian:"old-source"},projects:{}}} as Subscription;
  const load=vi.fn().mockResolvedValue(d);
  expect((await loadWatchProjects(sub,[],load,now))[0].changes).toEqual([]);
  sub.state={version:2,sourceVersions:{meridian:alertSourceVersion("meridian")},projects:{}};
  expect((await loadWatchProjects(sub,[],load,now))[0].changes.join(" ")).toContain("New project");
  sub.state={version:2,projects:{}};expect((await loadWatchProjects(sub,[],load,now))[0].changes).toEqual([]);
});
it("keeps a verified subsequent hearing after an intermediate approval without stale consideration wording",()=>{
  const d=alertFixture();d.item.recordStatus="Approved";d.item.stage="Council/Board";d.next!.startsAt="2026-11-12";
  const p=emailProject(d,undefined,undefined,now);expect(p.snapshot.normalizedStatus).toBe("upcoming_hearing");expect(p.snapshot.next?.startsAt).toBe("2026-11-12");
});

it("persists the continuation in the Nampa feed and schedules follow-up even with an older cached feed",()=>{
  const row={appId:"ANN-00371-2026",description:"Braeburn Creek",energovPlanId:null,date:"2026-11-02",dateLabel:"Nov 2",body:"City Council" as const,bodyLabel:"City Council",sourceUrl:"https://official.example.test/notice",continuedNote:"Continued to 1/4/27"};
  expect(indexScheduledMeetings([row]).get(row.appId)?.map(m=>m.date)).toContain("2027-01-04");
  const feed={active:[hearingFixture(row.appId,{meetings:[row]})],completed:[]};
  expect(mergeMeetingIndex(emptySchedule(),{nampa:feed},AREAS).some(m=>m.date==="2027-01-04"&&m.caseIds.includes(row.appId))).toBe(true);
  const duplicate={...row,continuedNote:null};expect(scheduledContinuations([duplicate,row]).find(m=>m.date===row.date)?.continuedNote).toBe(row.continuedNote);
});
it("omits a supposedly specific official record when it redirects to a generic portal",async()=>{
  const d=alertFixture(),p=await verifyProjectLinks(emailProject(d,undefined,undefined,now),async()=>({ok:true,url:"https://nampa.primegov.com/public/portal"}));
  expect(p.linkChecks?.[d.officialRecords![0].url]).toMatchObject({ok:false,reason:"Redirect lost the case-specific record"});
});

it("uses a passed timed hearing even when a date-only last-hearing value is still today",()=>{
  const d=alertFixture();d.lastHearing="2026-11-10";d.next!.startsAt="2026-11-10T17:00:00Z";
  expect(emailProject(d,undefined,undefined,now).snapshot.normalizedStatus).toBe("hearing_passed_decision_pending");
});
it("omits impact claims whose nearby official source failed its link check",async()=>{
  const d=alertFixture();d.impacts=[{label:"Road work",value:"Synthetic documented road work.",url:"https://official.example.test/bad.pdf"}];
  const p=await verifyProjectLinks(emailProject(d,undefined,undefined,now),async url=>url.endsWith("bad.pdf")?{ok:false,reason:"HTTP 404"}:{ok:true,url});
  const message=digestTemplates([p],links,undefined,false,now)[0];expect(message.html+message.text).not.toContain("Synthetic documented road work");
});

it("disables every email mode, including explicit test and sign-in modes, in a production read-only audit",async()=>{
 const {sendAlertMail}=await import("../alerts");vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("LAW_READ_ONLY","true");
 try{for(const mode of ["live","test","internal","signin"] as const)await expect(sendAlertMail({to:"preview@example.invalid",subject:"Do not send",text:"offline",html:"<p>offline</p>",key:"offline",unsubscribe:"https://preview.invalid/remove",mode})).rejects.toThrow("read-only mode");}finally{vi.unstubAllEnvs();}
});
