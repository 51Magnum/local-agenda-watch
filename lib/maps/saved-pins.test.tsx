import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
const h=vi.hoisted(()=>({resident:vi.fn(),pins:vi.fn()}));
vi.mock("../resident-session",()=>({currentResident:h.resident}));
vi.mock("../resident-account",()=>({residentPins:h.pins,saveResidentPin:vi.fn(),removeResidentPin:vi.fn()}));
import {GET} from "../../app/api/account/pins/route";
import {safeReturnTo} from "../resident-auth";
import {parseSavedMapPins} from "./saved-pins";
import SavedPinsLayer from "../../app/components/maps/saved-pins-layer";
beforeEach(()=>{vi.stubEnv("VERCEL_ENV","production");vi.clearAllMocks();h.resident.mockResolvedValue({email:"owner@example.test",displayName:"Owner",plan:"paid"});});
afterEach(()=>vi.unstubAllEnvs());
const pin={id:"private-id",label:"Home",coordinates:[-116.4,43.6],radiusMiles:1,alertsEnabled:true};
it("requires resident sign-in and never reads pins for an anonymous map visitor",async()=>{
 h.resident.mockResolvedValue(null);const response=await GET();expect(response.status).toBe(401);expect(h.pins).not.toHaveBeenCalled();expect(response.headers.get("cache-control")).toContain("private, no-store");
});
it("returns all five active owner pins with independent radii and no profile identity or inactive pins",async()=>{
 const pins=[.25,.5,1,5,10].map((radiusMiles,i)=>({...pin,id:String(i),label:"Pin "+i,radiusMiles,source:"saved",archived:false}));h.pins.mockResolvedValue([...pins,{...pin,id:"inactive",archived:true}]);
 const response=await GET(),body=await response.json();expect(response.status).toBe(200);expect(h.pins).toHaveBeenCalledWith({email:"owner@example.test",displayName:"Owner",plan:"paid"});expect(body.pins).toHaveLength(5);expect(body.pins.map((p:typeof pin)=>p.radiusMiles)).toEqual([.25,.5,1,5,10]);expect(JSON.stringify(body)).not.toMatch(/owner@|displayName|source|archived|inactive/);
 expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("vary")).toBe("Cookie");expect(response.headers.get("x-robots-tag")).toContain("noindex");
});
it("shows only the current account's returned list and handles an account without pins",async()=>{
 h.pins.mockResolvedValue([]);expect(await(await GET()).json()).toEqual({pins:[]});
 h.resident.mockResolvedValue({email:"other@example.test",displayName:"Other",plan:"free"});await GET();expect(h.pins).toHaveBeenLastCalledWith({email:"other@example.test",displayName:"Other",plan:"free"});
});
it("stays database-free in Preview and keeps storage errors generic",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");expect((await GET()).status).toBe(403);expect(h.resident).not.toHaveBeenCalled();expect(h.pins).not.toHaveBeenCalled();
 vi.stubEnv("VERCEL_ENV","production");h.pins.mockRejectedValue(Error("owner@example.test secret pin"));const response=await GET();expect(response.status).toBe(503);expect(await response.text()).not.toMatch(/owner@|secret pin/);
});
it("keeps the return-to-map sign-in destination safe and strips any extra location data",()=>{
 expect(safeReturnTo("/?savedPins=1")).toBe("/?savedPins=1");expect(safeReturnTo("/?savedPins=1&lng=-116.4&lat=43.6&next=https://evil.test")).toBe("/?savedPins=1");expect(safeReturnTo("https://evil.test/?savedPins=1")).toBe("/profile");expect(safeReturnTo("/admin?savedPins=1")).toBe("/profile");
});
it("validates pin geometry/radius and only keeps the fields used by the private layer",()=>{
 expect(parseSavedMapPins({pins:[{...pin,email:"hidden@example.test"}]})).toEqual([pin]);
 for(const bad of [{pins:[{...pin,coordinates:[999,0]}]},{pins:[{...pin,radiusMiles:0}]},{pins:[{...pin,radiusMiles:Infinity}]},{pins:[{...pin,radiusMiles:11}]},{}])expect(()=>parseSavedMapPins(bad)).toThrow();
});
it("does not embed saved locations or fetch account data during public server rendering",()=>{
 const html=renderToStaticMarkup(<SavedPinsLayer open={false} ready={false} getMap={()=>null} onSelect={()=>{}} onRefreshSelected={()=>{}} onHide={()=>{}}/>);expect(html).toContain("Your saved pins");expect(html).not.toMatch(/owner@|private-id|-116\.4|43\.6/);expect(h.resident).not.toHaveBeenCalled();expect(h.pins).not.toHaveBeenCalled();
});
