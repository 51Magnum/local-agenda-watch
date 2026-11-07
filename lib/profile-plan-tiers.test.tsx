import {afterAll,beforeAll,beforeEach,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {renderToStaticMarkup} from "react-dom/server";
const h=vi.hoisted(()=>({db:undefined as unknown as PGlite,detail:vi.fn(),send:vi.fn()}));
vi.mock("pg",()=>({Pool:class{async query(sql:string,values?:unknown[]){return values?.length?h.db.query(sql,values):(await h.db.exec(sql)).at(-1);}async connect(){return{query:this.query.bind(this),release(){}};}}}));
vi.mock("./maps/project-detail",()=>({projectDetail:h.detail}));
import {residentDb} from "./resident-auth";
import {subscribeAlert,confirmAlert} from "./alerts";
import {residentPins,saveResidentPin,removeResidentPin,residentPlan} from "./resident-account";
import {PAID_PIN_LIMIT,pinLimit,validatePlanRadius} from "./plan-policy";
import {applyResidentSchema} from "./resident-schema";
import {deliverQueued,sendScheduledAlerts,type Delivery} from "./email/jobs";
import {emailProject} from "./email/project";
import {recipientDigest} from "./email/templates";
import ResidentPins from "../app/components/resident-pins";
import type {PaneData} from "./maps/project-questions";
const owner={email:"owner@example.test",displayName:"",plan:"paid" as const}; // deliberately stale/forged plan
const pin={kind:"place",label:"Home",coordinates:[-116.4,43.6],radiusMiles:1};
beforeAll(async()=>{h.db=new PGlite();await h.db.waitReady;vi.stubEnv("DATABASE_URL","fixture");vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("RESEND_API_KEY","fixture");vi.stubEnv("ALERTS_MAILING_ADDRESS","Example address");vi.stubEnv("ALERTS_DELIVERY_ENABLED","true");vi.stubGlobal("fetch",h.send);await residentDb();await h.db.exec("CREATE TABLE law_map_cases(area_id text,data jsonb)");},30000);
beforeEach(async()=>{
 await h.db.exec("TRUNCATE law_resident_profiles,law_alert_subscriptions,law_alert_deliveries,law_alert_recipient_checks,law_map_cases CASCADE");
 await h.db.query("INSERT INTO law_resident_profiles(scope,email,email_verified_at) VALUES('production',$1,now())",[owner.email]);
 h.send.mockReset().mockResolvedValue(Response.json({id:"fixture-mail"}));h.detail.mockReset();
});
afterAll(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await h.db.close();});
async function paid(){await h.db.query("UPDATE law_resident_profiles SET plan='paid' WHERE email=$1",[owner.email]);}
async function rawPin(radius=1){return h.db.query("INSERT INTO law_resident_pins(id,scope,email,label,longitude,latitude,radius_miles) VALUES($1,'production',$2,'Private home',-116.4,43.6,$3)",[randomUUID(),owner.email,radius]);}
it("defaults profiles to free and syncs the single paid allowance setting to the DB",async()=>{
 expect(await residentPlan(owner)).toBe("free");expect(pinLimit("free")).toBe(1);expect(Number((await h.db.query<{paid_pin_limit:number}>("SELECT paid_pin_limit FROM law_resident_plan_policy")).rows[0].paid_pin_limit)).toBe(PAID_PIN_LIMIT);
 await expect(h.db.query("UPDATE law_resident_profiles SET plan='enterprise'")).rejects.toThrow();
});
it("rejects free radius overrides and a second pin through the application, ignoring a forged paid session",async()=>{
 await expect(saveResidentPin(owner,{...pin,radiusMiles:2})).rejects.toThrow("1 mile");
 await saveResidentPin(owner,pin);await expect(saveResidentPin(owner,{...pin,label:"Work"})).rejects.toThrow("limit");
 const saved=(await residentPins(owner))[0];await expect(saveResidentPin(owner,{...pin,radiusMiles:.25},saved.id)).rejects.toThrow("1 mile");
 expect(await saveResidentPin(owner,{...pin,label:"Renamed"},saved.id)).toBe(true);
});
it("enforces free count/radius in the database even when application validation is bypassed",async()=>{
 await expect(rawPin(10)).rejects.toThrow("1 mile");await rawPin();await expect(rawPin()).rejects.toThrow("limit");
 await expect(h.db.query("UPDATE law_resident_pins SET radius_miles=2")).rejects.toThrow("1 mile");
});
it("rejects a multi-row insert that would exceed the allowance atomically",async()=>{
 await expect(h.db.query("INSERT INTO law_resident_pins(id,scope,email,label,longitude,latitude,radius_miles) VALUES($1,'production',$3,'One',0,0,1),($2,'production',$3,'Two',0,0,1)",[randomUUID(),randomUUID(),owner.email])).rejects.toThrow("limit");
 expect(await residentPins(owner)).toHaveLength(0);
});
it("allows paid pins with independent inclusive radii and enforces the configured limit at both layers",async()=>{
 await paid();for(let i=0;i<PAID_PIN_LIMIT;i++)await saveResidentPin(owner,{...pin,label:"Pin "+i,radiusMiles:i===0?.25:i===1?10:2});
 expect((await residentPins(owner)).map(p=>p.radiusMiles)).toEqual(expect.arrayContaining([.25,10,2]));
 await expect(saveResidentPin(owner,pin)).rejects.toThrow("limit");await expect(rawPin()).rejects.toThrow("limit");
 const saved=(await residentPins(owner))[0];await saveResidentPin(owner,{...pin,radiusMiles:5},saved.id);
 await removeResidentPin(owner,saved.id,"saved");await saveResidentPin(owner,pin);expect(await residentPins(owner)).toHaveLength(PAID_PIN_LIMIT);
});
it.each([0,.24,10.01,Infinity,NaN])("rejects out-of-range paid radius %s",async radius=>{await paid();expect(()=>validatePlanRadius("paid",radius)).toThrow();await expect(rawPin(radius)).rejects.toThrow();});
it("keeps pin ownership immutable in the database and inaccessible to another account",async()=>{
 await saveResidentPin(owner,pin);const saved=(await residentPins(owner))[0];
 await expect(h.db.query("UPDATE law_resident_pins SET email='someone@example.test'")).rejects.toThrow("ownership");
 expect(await removeResidentPin({email:"other@example.test",displayName:""},saved.id,"saved")).toBe(false);
 expect(await residentPins({email:"other@example.test",displayName:""})).toEqual([]);
});
it("preserves email consent: saving alone sends nothing; explicit opt-in creates one linked watch; deletion stops it",async()=>{
 await saveResidentPin(owner,pin);expect((await h.db.query("SELECT * FROM law_alert_subscriptions")).rows).toHaveLength(0);
 const saved=(await residentPins(owner))[0];await saveResidentPin(owner,pin,saved.id,"saved",true);
 expect((await residentPins(owner))[0].alertsEnabled).toBe(true);expect((await h.db.query("SELECT * FROM law_alert_subscriptions")).rows).toHaveLength(1);
 await saveResidentPin(owner,{...pin,label:"Updated"},saved.id,"saved",true);expect((await residentPins(owner))[0].label).toBe("Updated");
 await removeResidentPin(owner,saved.id,"saved");expect((await h.db.query<{unsubscribed_at:string}>("SELECT unsubscribed_at FROM law_alert_subscriptions")).rows[0].unsubscribed_at).toBeTruthy();expect(h.send).not.toHaveBeenCalled();
});
it("enforces the policy through legacy confirmed place-watch writes",async()=>{
 const insert=(radius:number)=>h.db.query("INSERT INTO law_alert_subscriptions(id,scope,email,target,confirm_hash,confirm_expires,unsubscribe_token,confirmed_at) VALUES($1,'production',$2,$3,'hash',now(),$4,now())",[randomUUID(),owner.email,JSON.stringify({...pin,radiusMiles:radius}),randomUUID()]);
 await expect(insert(2)).rejects.toThrow("1 mile");await insert(1);await expect(insert(1)).rejects.toThrow();expect(await residentPins(owner)).toHaveLength(1);
});
it("uses the free radius in public-watch confirmation and imports the confirmed pin without paid setup",async()=>{
 await subscribeAlert(owner.email,{kind:"place",label:"Home",coordinates:[-116.4,43.6],radiusMiles:3},"fixture-ip");
 expect(await residentPins(owner)).toHaveLength(0);
 const text=JSON.parse(h.send.mock.calls[0][1].body).text as string;
 expect(text).toContain("within 1 mile of Home");const token=text.match(/confirm\?token=([\w-]+)/)![1];
 expect(await confirmAlert(token)).toMatchObject({kind:"place",radiusMiles:1});expect(await residentPins(owner)).toMatchObject([{radiusMiles:1,alertsEnabled:true}]);
});
it("downgrades paid accounts atomically, retains excess locations inactive, fixes the radius and stops excess watches",async()=>{
 await paid();await saveResidentPin(owner,{...pin,radiusMiles:2},undefined,"saved",true);await saveResidentPin(owner,{...pin,label:"Work",radiusMiles:10},undefined,"saved",true);
 await h.db.query("UPDATE law_resident_profiles SET plan='free' WHERE email=$1",[owner.email]);
 const pins=await residentPins(owner);expect(pins.filter(p=>!p.archived)).toHaveLength(1);expect(pins.every(p=>p.radiusMiles===1)).toBe(true);expect(pins.filter(p=>p.alertsEnabled)).toHaveLength(1);expect(pins.filter(p=>p.archived)).toHaveLength(1);
 await expect(rawPin()).rejects.toThrow("limit");
});
it("renders the plan, locked free radius, upgrade note and pin controls only in the private manager",()=>{
 const free=renderToStaticMarkup(<ResidentPins plan="free" pins={[]}/>);expect(free).toContain("1 mile (locked");expect(free).toContain("administrator");expect(free).toContain('type="hidden" name="radiusMiles" value="1"');
 const paidHtml=renderToStaticMarkup(<ResidentPins plan="paid" pins={[]}/>);expect(paidHtml).toContain('min="0.25" max="10"');expect(paidHtml).toContain(`of ${PAID_PIN_LIMIT} active pins`);
});
function project():PaneData{return {area:{id:"nampa",name:"City of Nampa",timezone:"America/Denver",planningBody:"P&Z",decisionBody:"City Council"},item:{id:"ANN-00371-2026",title:"Example subdivision",href:"/us/id/nampa/plan/ANN-00371-2026",type:"ANN",typeLabel:"Annexation",summary:"",stage:"In review",geometry:null,centroid:[-116.4,43.6],source:"none",confidence:"approximate",citywide:false,flumCategories:[],popup:{projectName:"Example subdivision",headline:"Proposed homes",progress:[]}},history:[],impacts:[],conditions:[],caseIds:["ANN-00371-2026"],updatedAt:"2026-11-03"};}
it("matches every paid pin at its own radius, dedupes overlaps, and sends one email per recipient",async()=>{
 await paid();await saveResidentPin(owner,{...pin,radiusMiles:.25},undefined,"saved",true);await saveResidentPin(owner,{...pin,label:"Work",coordinates:[-116.42,43.6],radiusMiles:10},undefined,"saved",true);
 const data=project(),far=project();far.item={...far.item,id:"ANN-00400-2026",href:"/us/id/nampa/plan/ANN-00400-2026",centroid:[-116.45,43.6],popup:{projectName:"Second subdivision",headline:"Other homes",progress:[]}};far.caseIds=[far.item.id];
 h.detail.mockImplementation(async(_area:string,id:string)=>id===data.item.id?data:far);
 for(const d of [data,far]){const [x,y]=d.item.centroid!;d.item.geometry={type:"Polygon",coordinates:[[[x-.0001,y-.0001],[x+.0001,y-.0001],[x+.0001,y+.0001],[x-.0001,y+.0001],[x-.0001,y-.0001]]]};await h.db.query("INSERT INTO law_map_cases VALUES('nampa',$1)",[JSON.stringify(d.item)]);}
 const old=[data,far].map(d=>{const s=emailProject(d).snapshot;return {...s,status:"Filed"};});
 await h.db.query("UPDATE law_alert_subscriptions SET state=$1",[JSON.stringify({version:2,projects:Object.fromEntries(old.map(s=>[s.key,s]))})]);
 const result=await sendScheduledAlerts();expect(result).toMatchObject({sent:1,checked:1,failures:0});expect(h.send).toHaveBeenCalledTimes(1);
 const delivery=(await h.db.query<{states:Record<string,{projects:Record<string,unknown>}>;payload:{projects:unknown[]}}>("SELECT states,payload FROM law_alert_deliveries")).rows[0];
 expect(delivery.payload.projects).toHaveLength(2);expect(Object.values(delivery.states).map(s=>Object.keys(s.projects).length).sort()).toEqual([1,2]);
 expect((await sendScheduledAlerts()).sent).toBe(0);expect(h.send).toHaveBeenCalledTimes(1);
 await saveResidentPin(owner,{...pin,label:"Third",radiusMiles:5},undefined,"saved",true);
 data.item.recordStatus="Approved";data.item.stage="Decided";
 expect((await sendScheduledAlerts()).sent).toBe(0);expect(h.send).toHaveBeenCalledTimes(1);
 expect((await h.db.query("SELECT id FROM law_alert_deliveries WHERE kind='digest'")).rows).toHaveLength(1);
});
it("uses a single bounded message for a large set of overlapping pin results",()=>{
 const p=emailProject(project()),many=Array.from({length:80},(_,i)=>({...p,snapshot:{...p.snapshot,key:p.snapshot.key+"-"+i,name:"Project "+i}}));
 const messages=recipientDigest([...many,...many],{mailingAddress:"Example",unsubscribe:"https://example.test/remove",manage:"https://example.test/manage"});expect(messages).toHaveLength(1);expect(messages[0].text).toContain("30 additional projects");expect(Buffer.byteLength(messages[0].html+messages[0].text)).toBeLessThan(100000);
});
it("migrates old saved and confirmed single pins once, leaves pending/stopped watches alone, and has a working down migration",async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec(`CREATE TABLE law_alert_subscriptions(id uuid PRIMARY KEY,scope text,email text,target jsonb,confirmed_at timestamptz,unsubscribed_at timestamptz,created_at timestamptz DEFAULT now(),state jsonb,UNIQUE(scope,email,target));CREATE TABLE law_alert_deliveries(status text,last_error text,kind text);`);
  await db.exec(await readFile("migrations/20261103_resident_login.up.sql","utf8"));
  await db.exec("INSERT INTO law_resident_profiles(scope,email,email_verified_at) VALUES('production','saved@example.test',now())");
  await db.query("INSERT INTO law_resident_pins(id,scope,email,label,longitude,latitude,radius_miles) VALUES($1,'production','saved@example.test','Old saved pin',-116.4,43.6,3)",[randomUUID()]);
  for(const [label,confirmed,stopped]of [["Old alert",true,false],["Extra alert",true,false],["Pending",false,false],["Old alert",true,true]] as const)await db.query("INSERT INTO law_alert_subscriptions(id,scope,email,target,confirmed_at,unsubscribed_at) VALUES($1,'production','alert@example.test',$2,$3,$4)",[randomUUID(),JSON.stringify({...pin,label,radiusMiles:stopped?1:4}),confirmed?new Date():null,stopped?new Date():null]);
  const adapter={connect:async()=>({query:async(sql:string,values?:unknown[])=>values?.length?db.query(sql,values):(await db.exec(sql)).at(-1),release(){}})} as unknown as Parameters<typeof applyResidentSchema>[0];
  await applyResidentSchema(adapter);await applyResidentSchema(adapter);
  const rows=(await db.query<{radius_miles:number;plan:string;archived:boolean}>("SELECT radius_miles,plan,archived FROM law_resident_pins JOIN law_resident_profiles USING(scope,email)")).rows;expect(rows).toHaveLength(3);expect(rows.every(p=>p.radius_miles===1&&p.plan==="free")).toBe(true);expect(rows.filter(p=>p.archived)).toHaveLength(1);
  expect((await db.query<{confirmed_at:string}>("SELECT confirmed_at FROM law_alert_subscriptions WHERE target->>'label'='Pending'")).rows[0].confirmed_at).toBeNull();
  await db.exec(await readFile("migrations/20261103_profile_plan_tiers.down.sql","utf8"));expect((await db.query("SELECT * FROM law_resident_pins")).rows).toHaveLength(3);
 }finally{await db.close();}
},15000);

it("baselines wording changes without sending, then delivers a real official status change",async()=>{
 await saveResidentPin(owner,pin,undefined,"saved",true);
 const d=project();d.item.geometry={type:"Polygon",coordinates:[[[-116.401,43.599],[-116.399,43.599],[-116.399,43.601],[-116.401,43.601],[-116.401,43.599]]]};
 h.detail.mockResolvedValue(d);await h.db.query("INSERT INTO law_map_cases VALUES('nampa',$1)",[JSON.stringify(d.item)]);
 d.item.stage="Decided";d.item.recordStatus="Approved";d.item.decisionDate="2025-05-20";
 const old=emailProject(d).snapshot;
 await h.db.query("UPDATE law_alert_subscriptions SET state=$1",[JSON.stringify({version:2,projects:{[old.key]:old}})]);
 d.item.popup!.headline="Clearer project description";d.history=[{label:"Decided; outcome not specified in city record"}];
 expect(await sendScheduledAlerts()).toMatchObject({sent:0,failures:0});expect(h.send).not.toHaveBeenCalled();
 const saved=(await h.db.query<{state:{projects:Record<string,{headline:string}>}}>("SELECT state FROM law_alert_subscriptions")).rows[0];
 expect(saved.state.projects[old.key].headline).toBe("Clearer project description");
 await h.db.query("UPDATE law_alert_subscriptions SET last_sent=current_date-2");
 d.item.recordStatus="Denied";
 expect(await sendScheduledAlerts()).toMatchObject({sent:1,failures:0});expect(h.send).toHaveBeenCalledTimes(1);
});
it("cancels an unsent digest rendered by the old alert policy before calling the mail provider",async()=>{
 await h.db.query("INSERT INTO law_alert_deliveries(id,scope,email,kind,payload) VALUES('old-policy','production',$1,'digest',$2)",[owner.email,JSON.stringify({messages:[{subject:"Old misleading update",html:"old",text:"old",preheader:"old"}],unsubscribe:"https://example.test/remove"})]);
 const row=(await h.db.query<Delivery>("SELECT * FROM law_alert_deliveries WHERE id='old-policy'")).rows[0];
 expect(await deliverQueued(row)).toBe(false);expect(h.send).not.toHaveBeenCalled();
 expect((await h.db.query<{status:string}>("SELECT status FROM law_alert_deliveries WHERE id='old-policy'")).rows[0].status).toBe("cancelled");
});
