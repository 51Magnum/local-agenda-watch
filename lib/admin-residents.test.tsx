import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {randomUUID,createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {renderToStaticMarkup} from "react-dom/server";
import {NextRequest} from "next/server";
const h=vi.hoisted(()=>({db:undefined as unknown as PGlite,authorization:"",fetch:vi.fn()}));
vi.mock("pg",()=>({Pool:class{async query(sql:string,values?:unknown[]){return values?.length?h.db.query(sql,values):(await h.db.exec(sql)).at(-1);}async connect(){return{query:this.query.bind(this),release(){}};}}}));
vi.mock("next/headers",()=>({headers:async()=>new Headers(h.authorization?{authorization:h.authorization}:{})}));
vi.mock("next/navigation",()=>({notFound:()=>{throw Error("NOT_FOUND");}}));
import {residentDb,requestSignIn,consumeSignIn} from "./resident-auth";
import {saveResidentPin,residentPins} from "./resident-account";
import {applyResidentSchema} from "./resident-schema";
import {searchResidents,adminResidentDetail,prepareResidentPlanChange,commitResidentPlanChange,recentPlanChanges} from "./admin-residents";
import {adminResidentTime} from "./admin-resident-types";
import ResidentsAdmin from "../app/admin/residents/page";
import ResidentDetail from "../app/admin/residents/[id]/page";
import {POST as searchRoute} from "../app/admin/residents/search/route";
import * as searchModule from "../app/admin/residents/search/route";
import {POST as actionRoute} from "../app/admin/residents/action/route";
import {proxy} from "../proxy";
const authorization="Basic "+Buffer.from("admin:fixture-admin-password").toString("base64"),origin="https://www.localagendawatch.com";
const resident={email:"owner@example.test",displayName:""},pin={kind:"place",label:"Private home",coordinates:[-116.4,43.6],radiusMiles:1};
async function addProfile(email=resident.email,plan="free",scope="production"){
 return (await h.db.query<{resident_id:string}>("INSERT INTO law_resident_profiles(scope,email,plan,email_verified_at,created_at,last_sign_in_at) VALUES($1,$2,$3,'2026-11-01T10:00:00Z','2026-10-30T14:00:00Z',NULL) RETURNING resident_id",[scope,email,plan])).rows[0].resident_id;
}
function form(data:Record<string,string>,auth=authorization,source=origin){return new Request(origin+"/admin/residents/action",{method:"POST",headers:{authorization:auth,origin:source},body:new URLSearchParams(data)});}
function search(email:unknown,mode:unknown="partial",auth=authorization,source=origin){return new Request(origin+"/admin/residents/search",{method:"POST",headers:{authorization:auth,origin:source,"Content-Type":"application/json"},body:JSON.stringify({email,mode})});}
beforeAll(async()=>{h.db=new PGlite();await h.db.waitReady;vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("DATABASE_URL","fixture-only");vi.stubEnv("REVIEW_ADMIN_PASSWORD","fixture-admin-password");vi.stubGlobal("fetch",h.fetch);await residentDb();},30000);
beforeEach(async()=>{h.authorization=authorization;h.fetch.mockReset().mockRejectedValue(Error("External requests forbidden in fixture"));await h.db.exec("TRUNCATE law_resident_profiles,law_alert_subscriptions,law_resident_login_links,law_alert_limits CASCADE");});
afterEach(async()=>{vi.restoreAllMocks();vi.stubEnv("VERCEL_ENV","production");await h.db.exec("DROP TRIGGER IF EXISTS fixture_audit_failure ON law_resident_plan_changes;DROP FUNCTION IF EXISTS fixture_audit_failure()");});
afterAll(async()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();await h.db.close();});
it("requires the existing reviewer login before any account read or plan action",async()=>{
 const spy=vi.spyOn(h.db,"query");await expect(searchResidents(null,"")).rejects.toMatchObject({status:401});await expect(adminResidentDetail(null,randomUUID())).rejects.toMatchObject({status:401});await expect(recentPlanChanges(null)).rejects.toMatchObject({status:401});
 await expect(prepareResidentPlanChange(null,randomUUID(),"paid")).rejects.toMatchObject({status:401});await expect(commitResidentPlanChange(null,"A".repeat(43))).rejects.toMatchObject({status:401});expect(spy).not.toHaveBeenCalled();
});
it("finds exact and partial emails case-insensitively without leaking names or locations",async()=>{
 await addProfile();await addProfile("another@example.test");await addProfile("hidden@example.test","free","preview:other");await saveResidentPin(resident,pin);
 expect((await searchResidents(authorization," OWNER@EXAMPLE.TEST ","exact")).residents).toMatchObject([{email:resident.email,plan:"free",activePins:1,inactivePins:0,lastSignInAt:null}]);
 const partial=await searchResidents(authorization,"EXAMPLE");expect(partial.residents).toHaveLength(2);expect(JSON.stringify(partial)).not.toMatch(/longitude|latitude|coordinates|Private home|display_name|-116\.4|43\.6/);
 expect((await searchResidents(authorization,"missing","exact")).residents).toEqual([]);
});
it("treats SQL wildcard and injection-like input as literal search text",async()=>{
 await addProfile("under_score@example.test");await addProfile("underscore@example.test");await addProfile("percent%tag@example.test");
 expect((await searchResidents(authorization,"under_score")).residents).toHaveLength(1);expect((await searchResidents(authorization,"%")).residents).toHaveLength(1);expect((await searchResidents(authorization,"' OR 1=1 --")).residents).toEqual([]);
 await expect(searchResidents(authorization,"x".repeat(255))).rejects.toMatchObject({status:400});
});
it("bounds broad results and asks the admin to refine the search",async()=>{
 for(let i=0;i<52;i++)await addProfile(`person${i}@example.test`);
 const result=await searchResidents(authorization,"");expect(result.residents).toHaveLength(50);expect(result.hasMore).toBe(true);
});
it("shows pin labels, radius, active status and alert consent in detail without fetching coordinates",async()=>{
 const id=await addProfile(resident.email,"paid");await saveResidentPin(resident,{...pin,radiusMiles:2},undefined,"saved",true);await saveResidentPin(resident,{...pin,label:"Private work",radiusMiles:10});
 const detail=await adminResidentDetail(authorization,id);expect(detail.pins).toMatchObject([{label:"Private home",radiusMiles:2,active:true,alertsEnabled:true},{label:"Private work",radiusMiles:10,active:true,alertsEnabled:false}]);
 expect(JSON.stringify(detail)).not.toMatch(/coordinates|longitude|latitude|-116\.4|43\.6/);
 await expect(adminResidentDetail(authorization,"not-an-id")).rejects.toMatchObject({status:404});await expect(adminResidentDetail(authorization,randomUUID())).rejects.toMatchObject({status:404});
});
it("prepares a hashed, expiring confirmation without changing the plan or writing an audit event",async()=>{
 const id=await addProfile(),change=await prepareResidentPlanChange(authorization,id,"paid");
 expect((await adminResidentDetail(authorization,id)).resident.plan).toBe("free");expect(await recentPlanChanges(authorization)).toHaveLength(0);
 const stored=(await h.db.query<{token_hash:string;expires_at:string}>("SELECT token_hash,expires_at FROM law_resident_plan_intents")).rows[0];expect(stored.token_hash).toBe(createHash("sha256").update(change.token).digest("hex"));expect(stored.token_hash).not.toBe(change.token);expect(Date.parse(stored.expires_at)).toBeGreaterThan(Date.now());
 await expect(prepareResidentPlanChange(authorization,id,"free")).rejects.toMatchObject({status:400});await expect(prepareResidentPlanChange(authorization,id,"enterprise")).rejects.toMatchObject({status:400});
});
it("changes plan and records one atomic private audit event, rejecting token reuse",async()=>{
 const id=await addProfile(),change=await prepareResidentPlanChange(authorization,id,"paid");expect(await commitResidentPlanChange(authorization,change.token)).toBe(id);
 expect((await adminResidentDetail(authorization,id)).resident.plan).toBe("paid");const changes=await recentPlanChanges(authorization,id);expect(changes).toMatchObject([{actor:"admin",action:"resident.plan.change",oldPlan:"free",newPlan:"paid",residentId:id,email:resident.email}]);expect(changes[0].createdAt).toBeTruthy();
 const privateRow=(await h.db.query("SELECT * FROM law_resident_plan_changes")).rows[0];expect(JSON.stringify(privateRow)).not.toMatch(/owner@|Private home|coordinates|password|authorization/);
 await expect(commitResidentPlanChange(authorization,change.token)).rejects.toMatchObject({status:409});expect(await recentPlanChanges(authorization)).toHaveLength(1);
});
it("uses existing DB triggers on downgrade, retaining one 1-mile pin and stopping excess alerts",async()=>{
 const id=await addProfile(resident.email,"paid");await saveResidentPin(resident,{...pin,radiusMiles:2},undefined,"saved",true);await saveResidentPin(resident,{...pin,label:"Work",radiusMiles:10},undefined,"saved",true);
 const change=await prepareResidentPlanChange(authorization,id,"free");await commitResidentPlanChange(authorization,change.token);
 const pins=await residentPins(resident);expect(pins.filter(p=>!p.archived)).toHaveLength(1);expect(pins.filter(p=>p.alertsEnabled)).toHaveLength(1);expect(pins.every(p=>p.radiusMiles===1)).toBe(true);expect(pins.filter(p=>p.archived)).toHaveLength(1);
 expect((await searchResidents(authorization,resident.email,"exact")).residents[0]).toMatchObject({activePins:1,inactivePins:1,plan:"free"});
 const upgrade=await prepareResidentPlanChange(authorization,id,"paid");await commitResidentPlanChange(authorization,upgrade.token);expect((await residentPins(resident)).filter(p=>p.archived)).toHaveLength(1);expect((await residentPins(resident)).filter(p=>p.alertsEnabled)).toHaveLength(1);
});
it("rejects expired, forged, and stale confirmations without adding audit events",async()=>{
 const id=await addProfile(),expired=await prepareResidentPlanChange(authorization,id,"paid");await h.db.exec("UPDATE law_resident_plan_intents SET expires_at=now()-interval '1 minute'");
 await expect(commitResidentPlanChange(authorization,expired.token)).rejects.toMatchObject({status:409});await expect(commitResidentPlanChange(authorization,"X".repeat(43))).rejects.toMatchObject({status:409});
 const stale=await prepareResidentPlanChange(authorization,id,"paid");await h.db.query("UPDATE law_resident_profiles SET plan='paid' WHERE resident_id=$1",[id]);await expect(commitResidentPlanChange(authorization,stale.token)).rejects.toMatchObject({status:409});expect(await recentPlanChanges(authorization)).toHaveLength(0);
});
it("rolls back the plan and all trigger changes if the audit insert fails",async()=>{
 const id=await addProfile(resident.email,"paid");await saveResidentPin(resident,{...pin,radiusMiles:2},undefined,"saved",true);await saveResidentPin(resident,{...pin,label:"Work",radiusMiles:5},undefined,"saved",true);
 const change=await prepareResidentPlanChange(authorization,id,"free");
 await h.db.exec("CREATE FUNCTION fixture_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit unavailable'; END $$;CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON law_resident_plan_changes FOR EACH ROW EXECUTE FUNCTION fixture_audit_failure()");
 await expect(commitResidentPlanChange(authorization,change.token)).rejects.toThrow();expect((await adminResidentDetail(authorization,id)).resident.plan).toBe("paid");const pins=await residentPins(resident);expect(pins.filter(p=>p.archived)).toHaveLength(0);expect(pins.filter(p=>p.alertsEnabled)).toHaveLength(2);expect(await recentPlanChanges(authorization)).toHaveLength(0);
});
it("protects search/action routes with admin authentication and same-origin checks",async()=>{
 for(const response of [await searchRoute(search("owner","partial","")),await actionRoute(form({action:"review"},""))])expect(response.status).toBe(401);
 expect((await searchRoute(search("owner","partial",authorization,"https://evil.test"))).status).toBe(403);expect((await actionRoute(form({action:"review"},authorization,"https://evil.test"))).status).toBe(403);
 expect("GET" in searchModule).toBe(false);
});
it("requires the two-step confirmation, then redirects using only an opaque account ID",async()=>{
 const id=await addProfile();expect((await actionRoute(form({action:"confirm",confirmed:"yes",residentId:id,plan:"paid"}))).status).toBe(400);
 const review=await actionRoute(form({action:"review",residentId:id,plan:"paid"})),html=await review.text();expect(review.status).toBe(200);expect(html).toContain("Confirm plan change");expect(html).toContain('name="confirmed"');expect(html).toContain("Existing inactive pins and stopped emails stay inactive");
 const token=html.match(/name="intent" value="([\w-]+)"/)![1];
 expect((await actionRoute(form({action:"confirm",intent:token}))).status).toBe(400);
 const saved=await actionRoute(form({action:"confirm",confirmed:"yes",intent:token,plan:"free",actor:"forged"}));expect(saved.status).toBe(303);expect(saved.headers.get("location")).toBe(`/admin/residents/${id}?changed=1`);expect(saved.headers.get("location")).not.toContain("owner");expect((await adminResidentDetail(authorization,id)).resident.plan).toBe("paid");expect((await recentPlanChanges(authorization))[0].actor).toBe("admin");
});
it("keeps search responses private, uncached and free of pin labels/locations",async()=>{
 await addProfile();await saveResidentPin(resident,pin);const response=await searchRoute(search("owner"));expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("private, no-store");expect(response.headers.get("x-robots-tag")).toContain("noindex");const body=await response.text();expect(body).toContain(resident.email);expect(body).not.toMatch(/Private home|coordinates|longitude|latitude|-116\.4/);
});
it("returns generic errors without logging personal data from a database error",async()=>{
 const spy=vi.spyOn(console,"error").mockImplementation(()=>{}),query=vi.spyOn(h.db,"query").mockRejectedValueOnce(Error("owner@example.test at -116.4,43.6"));
 const response=await searchRoute(search("owner"));expect(response.status).toBe(503);expect(await response.text()).not.toMatch(/owner@|-116/);expect(spy).not.toHaveBeenCalled();query.mockRestore();
});
it("denies pages before loading data and renders protected list/detail without coordinate fields",async()=>{
 h.authorization="";const spy=vi.spyOn(h.db,"query");expect(renderToStaticMarkup(await ResidentsAdmin())).toContain("Admin access required");expect(spy).not.toHaveBeenCalled();spy.mockRestore();
 h.authorization=authorization;const id=await addProfile();await saveResidentPin(resident,pin);
 const list=renderToStaticMarkup(await ResidentsAdmin());expect(list).toContain(resident.email);expect(list).not.toMatch(/Private home|-116\.4|longitude|latitude/);expect(list).not.toContain('method="get"');expect(list).toContain('method="post"');expect(list).toContain('action="/admin/residents/search"');
 const detail=renderToStaticMarkup(await ResidentDetail({params:Promise.resolve({id}),searchParams:Promise.resolve({})}));expect(detail).toContain("Private home");expect(detail).toContain("Review plan change");expect(detail).not.toMatch(/-116\.4|longitude|latitude/);
 await expect(ResidentDetail({params:Promise.resolve({id:randomUUID()}),searchParams:Promise.resolve({})})).rejects.toThrow("NOT_FOUND");
});
it("inherits admin protection and private/noindex headers for every resident route without protecting public pages",()=>{
 for(const path of ["/admin/residents","/admin/residents/"+randomUUID(),"/admin/residents/search","/admin/residents/action"]){const denied=proxy(new NextRequest(origin+path));expect(denied?.status).toBe(401);expect(denied?.headers.get("cache-control")).toContain("no-store");expect(denied?.headers.get("x-robots-tag")).toContain("noindex");const allowed=proxy(new NextRequest(origin+path,{headers:{authorization}}));expect(allowed?.status).toBe(200);expect(allowed?.headers.get("cache-control")).toContain("private");}
 for(const path of ["/","/about","/disclaimer"])expect(proxy(new NextRequest(origin+path))).toBeUndefined();
});
it("does not access storage from Preview pages or routes",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");const spy=vi.spyOn(h.db,"query");expect(renderToStaticMarkup(await ResidentsAdmin())).toContain("Not available in preview");expect((await searchRoute(search("owner"))).status).toBe(403);expect((await actionRoute(form({action:"review"}))).status).toBe(403);expect(spy).not.toHaveBeenCalled();
});
it("formats dates in Mountain Time and never renders raw timezone identifiers",()=>{
 expect(adminResidentTime(null)).toBe("Not recorded");const text=adminResidentTime("2026-11-03T18:30:00Z");expect(text).toContain("November 3, 2026");expect(text).toContain("11:30 AM MST");expect(text).not.toContain("America/");
});
it("updates last sign-in only after successfully consuming a magic link",async()=>{
 const id=await addProfile(),now=new Date();vi.stubEnv("RESEND_API_KEY","fixture");vi.stubEnv("ALERTS_MAILING_ADDRESS","Example address");h.fetch.mockResolvedValue(Response.json({id:"fixture-mail"}));
 await requestSignIn(resident.email,"fixture-ip","/profile",now);expect((await adminResidentDetail(authorization,id)).resident.lastSignInAt).toBeNull();
 const token=new URLSearchParams(new URL(JSON.parse(h.fetch.mock.calls[0][1].body).text.match(/https:\/\/\S+/)[0]).hash.slice(1)).get("token")!;
 await consumeSignIn(token,undefined,now);expect((await adminResidentDetail(authorization,id)).resident.lastSignInAt).toBe(now.toISOString());
 await consumeSignIn(token,undefined,new Date(now.getTime()+5000));expect((await adminResidentDetail(authorization,id)).resident.lastSignInAt).toBe(now.toISOString());
});
it("applies the normal migration idempotently, backfills known session history, and supports down",async()=>{
 const id=await addProfile();await h.db.query("INSERT INTO law_resident_sessions(token_hash,scope,email,expires_at,created_at) VALUES('fixture','production',$1,now()+interval '1 day','2026-11-02T18:00:00Z')",[resident.email]);
 const client=await(await residentDb()).connect();try{
  await client.query("BEGIN");await client.query(await readFile("migrations/20261103_admin_residents.down.sql","utf8"));await client.query("DELETE FROM law_schema_migrations WHERE id='20261103_admin_residents.up.sql'");await client.query("COMMIT");
 }finally{client.release();}
 await applyResidentSchema(await residentDb());await applyResidentSchema(await residentDb());
 const result=await searchResidents(authorization,resident.email,"exact");expect(result.residents[0].lastSignInAt).toBe("2026-11-02T18:00:00.000Z");expect(result.residents[0].id).not.toBe(id);
});
