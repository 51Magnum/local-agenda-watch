import {afterAll,beforeAll,beforeEach,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {randomUUID} from "node:crypto";
const h=vi.hoisted(()=>({db:undefined as unknown as PGlite,send:vi.fn()}));
vi.mock("pg",()=>({Pool:class{async query(sql:string,values?:unknown[]){return values?.length?h.db.query(sql,values):(await h.db.exec(sql)).at(-1);}async connect(){return{query:this.query.bind(this),release(){}};}}}));
import {alertsDb} from "./alerts";
import {authHash,consumeSignIn,normalizeResidentEmail,requestSignIn,residentDb,residentForSession,revokeResidentSession,safeReturnTo,SESSION_SECONDS} from "./resident-auth";
import {residentPins,residentWatches,saveResidentPin,removeResidentPin,saveResidentName} from "./resident-account";
const now=new Date("2026-11-03T12:00:00Z");
beforeAll(async()=>{h.db=new PGlite();await h.db.waitReady;vi.stubEnv("DATABASE_URL","test");vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("RESEND_API_KEY","fixture");vi.stubEnv("ALERTS_MAILING_ADDRESS","Example mailing address");vi.stubEnv("ALERTS_DELIVERY_ENABLED","false");vi.stubGlobal("fetch",h.send);await residentDb();},30000);
beforeEach(async()=>{h.send.mockReset().mockImplementation(async()=>Response.json({id:"fixture-email"}));await h.db.exec("TRUNCATE law_resident_profiles CASCADE;TRUNCATE law_resident_login_links,law_alert_limits,law_alert_subscriptions CASCADE");});
afterAll(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await h.db.close();});
async function link(email="owner@example.test",ip="one"){
 await requestSignIn(email,ip,"/pins?lng=-116.4&lat=43.6",now);
 const payload=JSON.parse(h.send.mock.calls.at(-1)![1].body),url=payload.text.match(/https:\/\/\S+/)[0],token=new URLSearchParams(new URL(url).hash.slice(1)).get("token")!;
 return{token,payload,url};
}
it("normalizes existing subscriber identities without merging different email aliases",()=>{expect(normalizeResidentEmail(" Owner@Example.TEST ")).toBe("owner@example.test");expect(normalizeResidentEmail("one+pin@example.test")).toBe("one+pin@example.test");expect(normalizeResidentEmail("one@example.test,other@example.test")).toBeUndefined();});
it.each(["https://evil.test/pins","//evil.test/profile","/\\evil.test","/profile\r\nLocation:bad","/api/admin"])("rejects unsafe or non-account return destinations: %s",value=>expect(safeReturnTo(value)).toBe("/profile"));
it("preserves a map pin through the sign-in return path",()=>expect(safeReturnTo("/pins?lng=-116.4&lat=43.6&label=Home")).toBe("/pins?lng=-116.4&lat=43.6&label=Home"));
it("sends through existing Resend settings, stores only a hash, and expires in exactly 15 minutes",async()=>{
 const {token,payload,url}=await link();expect(payload.to).toEqual(["owner@example.test"]);expect(payload.html).toContain("15 minutes");expect(payload.headers).toBeUndefined();expect(new URL(url).search).toBe("");
 const row=(await h.db.query<{token_hash:string;expires_at:Date}>("SELECT token_hash,expires_at FROM law_resident_login_links")).rows[0];expect(row.token_hash).toBe(authHash(token));expect(row.token_hash).not.toContain(token);expect(new Date(row.expires_at).getTime()-now.getTime()).toBe(15*60000);
 expect((await h.db.query("SELECT * FROM law_alert_subscriptions")).rows).toHaveLength(0);
});
it("consumes a link once and atomically rejects concurrent reuse",async()=>{
 const {token}=await link(),results=await Promise.all([consumeSignIn(token,undefined,now),consumeSignIn(token,undefined,now)]);expect(results.filter(Boolean)).toHaveLength(1);expect((await h.db.query("SELECT * FROM law_resident_sessions")).rows).toHaveLength(1);expect((await h.db.query("SELECT * FROM law_resident_login_links")).rows).toHaveLength(0);
});
it("rejects expired and tampered magic links without creating a session",async()=>{const {token}=await link();expect(await consumeSignIn(token,undefined,new Date(now.getTime()+15*60000))).toBeNull();expect(await consumeSignIn("A".repeat(43),undefined,now)).toBeNull();expect(await consumeSignIn("invalid",undefined,now)).toBeNull();expect((await h.db.query("SELECT * FROM law_resident_sessions")).rows).toHaveLength(0);});
it("creates a 30-day hashed session, expires it, rotates it, and revokes sign-out",async()=>{
 const first=await consumeSignIn((await link()).token,undefined,now);expect(first).toBeTruthy();expect(first!.expires.getTime()-now.getTime()).toBe(SESSION_SECONDS*1000);
 expect(await residentForSession(first!.token,now)).toMatchObject({email:"owner@example.test"});expect(await residentForSession(first!.token,new Date(now.getTime()+SESSION_SECONDS*1000))).toBeNull();
 const stored=(await h.db.query<{token_hash:string}>("SELECT token_hash FROM law_resident_sessions")).rows[0];expect(stored.token_hash).toBe(authHash(first!.token));
 const second=await consumeSignIn((await link()).token,first!.token,now);expect(await residentForSession(first!.token,now)).toBeNull();await revokeResidentSession(second!.token);expect(await residentForSession(second!.token,now)).toBeNull();
});
it("automatically links confirmed subscribers and pins without confirming or restarting other watches",async()=>{
 const db=await alertsDb();for(const [email,confirmed,stopped,label]of [["Owner@Example.Test",true,false,"Home"],["owner@example.test",false,false,"Pending"],["owner@example.test",true,true,"Stopped"],["other@example.test",true,false,"Not mine"]] as const)await db.query("INSERT INTO law_alert_subscriptions(id,scope,email,target,confirm_hash,confirm_expires,unsubscribe_token,confirmed_at,unsubscribed_at) VALUES($1,'production',$2,$3,'hash',now()+interval '1 day',$4,$5,$6)",[randomUUID(),email,JSON.stringify({kind:"place",label,coordinates:[-116.4,43.6],radiusMiles:1}),randomUUID(),confirmed?now:null,stopped?now:null]);
 const signed=await consumeSignIn((await link()).token,undefined,now),resident=(await residentForSession(signed!.token,now))!;
 expect(await residentPins(resident)).toMatchObject([{label:"Home",source:"saved"}]);expect(await residentWatches(resident)).toHaveLength(3);
 expect((await db.query("SELECT confirmed_at FROM law_alert_subscriptions WHERE target->>'label'='Pending'")).rows[0].confirmed_at).toBeNull();expect((await db.query("SELECT unsubscribed_at FROM law_alert_subscriptions WHERE target->>'label'='Stopped'")).rows[0].unsubscribed_at).not.toBeNull();
});
it("owns profile edits and saved pins by verified email; saving a pin never opts in to mail",async()=>{
 const login=await consumeSignIn((await link()).token,undefined,now),owner=(await residentForSession(login!.token,now))!,other={email:"other@example.test",displayName:""},pin={kind:"place",label:"Home",coordinates:[-116.4,43.6],radiusMiles:1};
 await saveResidentName(owner,"Shane");expect((await residentForSession(login!.token,now))?.displayName).toBe("Shane");await saveResidentPin(owner,pin);const saved=(await residentPins(owner))[0];
 expect(await saveResidentPin(other,{...pin,label:"Not yours"},saved.id)).toBe(false);expect(await removeResidentPin(other,saved.id,"saved")).toBe(false);expect(await residentPins(other)).toHaveLength(0);expect((await residentPins(owner))[0].label).toBe("Home");
 expect(await saveResidentPin(owner,{...pin,label:"Work"},saved.id)).toBe(true);expect(await removeResidentPin(owner,saved.id,"saved")).toBe(true);expect((await h.db.query("SELECT * FROM law_alert_subscriptions")).rows).toHaveLength(0);
});
it("requires pin ownership even when editing an existing alert watch",async()=>{
 const id=randomUUID();await(await alertsDb()).query("INSERT INTO law_alert_subscriptions(id,scope,email,target,confirm_hash,confirm_expires,unsubscribe_token,confirmed_at) VALUES($1,'production','owner@example.test',$2,'hash',now()+interval '1 day','token',now())",[id,JSON.stringify({kind:"place",label:"Home",coordinates:[-116.4,43.6],radiusMiles:1})]);
 const target={kind:"place",label:"Work",coordinates:[-116.3,43.7],radiusMiles:1};expect(await saveResidentPin({email:"other@example.test",displayName:""},target,id,"alert")).toBe(false);expect(await saveResidentPin({email:"owner@example.test",displayName:""},target,id,"alert")).toBe(true);
 await removeResidentPin({email:"owner@example.test",displayName:""},id,"alert");expect(await saveResidentPin({email:"owner@example.test",displayName:""},target,id,"alert")).toBe(false);
});
it("rate-limits normalized email across IPs and IP across different email addresses",async()=>{
 for(let i=0;i<5;i++)await requestSignIn(i%2?"OWNER@example.test":"owner@example.test","email-ip-"+i,"/profile",now);expect(h.send).toHaveBeenCalledTimes(3);
 h.send.mockClear();for(let i=0;i<12;i++)await requestSignIn("person"+i+"@example.test","shared-ip","/profile",now);expect(h.send).toHaveBeenCalledTimes(10);
 const limits=(await h.db.query<{key:string}>("SELECT key FROM law_alert_limits")).rows;expect(JSON.stringify(limits)).not.toContain("@example.test");expect(JSON.stringify(limits)).not.toContain("shared-ip");
});
it("removes a link whose mail delivery failed",async()=>{h.send.mockRejectedValueOnce(Error("Provider unavailable"));await expect(requestSignIn("owner@example.test","one","/profile",now)).rejects.toThrow();expect((await h.db.query("SELECT * FROM law_resident_login_links")).rows).toHaveLength(0);});
it("fails closed for Preview without looking up sessions or creating sign-in credentials",async()=>{vi.stubEnv("VERCEL_ENV","preview");try{expect(await residentForSession("S".repeat(43),now)).toBeNull();await expect(requestSignIn("owner@example.test","one","/profile",now)).rejects.toThrow("Writes are disabled");await expect(consumeSignIn("L".repeat(43),undefined,now)).rejects.toThrow("Writes are disabled");expect(h.send).not.toHaveBeenCalled();}finally{vi.stubEnv("VERCEL_ENV","production");}});
