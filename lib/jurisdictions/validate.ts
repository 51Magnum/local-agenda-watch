import type {JurisdictionDefinition} from "./types";
const platforms=new Set(["primegov","iqm2","escribe","adaFileBrowse","municipalClerk","countyLandHearings","civicplusArchive","municodePublishPage","sanityNotices","granicusPublisher"]);
function assert(value:unknown,message:string):asserts value {if(!value)throw Error("Jurisdiction config: "+message);}
export function contrastWithWhite(hex:string) {
 const channels=hex.slice(1).match(/../g)!.map(s=>parseInt(s,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 return 1.05/(.2126*channels[0]+.7152*channels[1]+.0722*channels[2]+.05);
}
export function validateJurisdictions(input:unknown[],recordedApprovals:ReadonlySet<string>=new Set()):JurisdictionDefinition[] {
 const ids=new Set<string>(),colors=new Set<string>();
 return input.map(raw=>{
  const d=raw as JurisdictionDefinition;
  assert(d&&/^[a-z]+(?:-[a-z]+)*$/.test(d.id),"invalid id");assert(!ids.has(d.id),"duplicate id "+d.id);ids.add(d.id);
  assert(d.name&&["city","county"].includes(d.type)&&/^[a-z]{2}$/.test(d.state),d.id+" identity");
  assert(d.timezone==="America/Boise",d.id+" timezone must be America/Boise");
  assert(/^#[a-f0-9]{6}$/i.test(d.color)&&!colors.has(d.color),d.id+" distinct color");colors.add(d.color);
  // Existing approved colors are unchanged; new text/badge colors must meet WCAG AA.
  assert(d.legacyPublic||contrastWithWhite(d.color)>=4.5,d.id+" color must contrast with white >=4.5");
  assert(Number.isInteger(d.mapOrder)&&d.mapOrder>0&&(d.type!=="city"||d.mapOrder>=100),d.id+" map order");
  assert(["draft","qa","admin_only","public"].includes(d.launchStatus)&&typeof d.enabled==="boolean",d.id+" launch policy");
  assert(d.launchStatus!=="public"||d.legacyPublic||recordedApprovals.has(d.id),d.id+" public launch requires database QA and recorded approval; JSON publication fields are not evidence");
  if(d.selfCheck?.minPassRate!==undefined)assert(d.selfCheck.minPassRate>=0&&d.selfCheck.minPassRate<=1,d.id+" invalid self-check pass rate");
  if(d.recordLinks){const policy=d.recordLinks,u=new URL(policy.verifyUrlTemplate);assert(policy.kind==="jsApp"&&!!d.applications.recordUrlTemplate&&u.protocol==="https:"&&!u.username&&!u.password&&policy.verifyUrlTemplate.includes("{recordId}"),d.id+" configured JavaScript record link");assert(policy.dataFields.includes(policy.idField)&&policy.dataFields.every(f=>/^\w+$/.test(f)&&!/applicant|owner|staff|planner|contact|email/i.test(f)),d.id+" restricted public record fields");assert(u.searchParams.get("f")==="json"&&(u.searchParams.get("outFields")??"").split(",").every(f=>policy.dataFields.includes(f)),d.id+" restricted JSON query");}
  assert(d.boundary?.source==="arcgis"&&d.boundary.outSR===4326,d.id+" boundary");
  const urls=[d.boundary.url,...Object.values(d.gis),...d.agenda.map(s=>String(s.params.baseUrl??s.params.url??"")),...(d.participation.testimonySignupUrl?[d.participation.testimonySignupUrl]:[])];
  for(const url of urls.filter(Boolean)){const u=new URL(url!);assert(u.protocol==="https:"&&!u.username&&!u.password,d.id+" HTTPS endpoint required");}
  assert(d.agenda.length>0&&d.agenda.every(s=>platforms.has(s.adapter)&&s.bodies.length>0),d.id+" agenda platform/bodies");
  assert(["arcgisFeatureLayer","accelaAca","none"].includes(d.applications.adapter),d.id+" application platform");
  assert(d.hearingBodies.length>0&&new Set(d.hearingBodies.map(b=>b.key)).size===d.hearingBodies.length,d.id+" hearing bodies");
  for(const body of d.hearingBodies){assert(["recommending","deciding","design","quasi-judicial"].includes(body.role),d.id+" hearing-body role");new RegExp(body.agendaBodyMatch,"i");}
  for(const source of d.agenda)for(const window of [source,...Object.values(source.bodyWindows??{})]){if(window.activeFrom)assert(/^\d{4}-\d{2}-\d{2}$/.test(window.activeFrom),d.id+" source start date");if(window.activeUntil)assert(/^\d{4}-\d{2}-\d{2}$/.test(window.activeUntil),d.id+" source end date");if(window.activeFrom&&window.activeUntil)assert(window.activeFrom<=window.activeUntil,d.id+" inverted source window");}
  for(const rule of d.participation.deadlineRules){assert(/^(?:THU_BEFORE|MON_BEFORE|SAME_DAY) (?:\d{2}:\d{2}|COB|DATE_ONLY)$/.test(rule.rule),d.id+" deadline rule");if(rule.timeVerified)assert(/ (?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.rule),d.id+" verified deadline requires a clock time");}
  for(const p of d.caseNumberPatterns)new RegExp(p,"gi");
  for(const [key,n]of Object.entries(d.costCaps))assert(Number.isFinite(n)&&n>0,d.id+" invalid cost cap "+key);
  assert(d.documents.maxBytes>0&&d.documents.maxPages>0&&d.documents.allowPackets===false,d.id+" document limits");
  if(d.documents.maxNativeBytes!==undefined)assert(Number.isFinite(d.documents.maxNativeBytes)&&d.documents.maxNativeBytes>=d.documents.maxBytes&&d.documents.maxNativeBytes<=160000000,d.id+" native download cap");
  if(d.clipRule)assert(d.type==="county"&&d.clipRule.operation==="subtractCityLimits",d.id+" clip rule");
  return d;
 });
}
