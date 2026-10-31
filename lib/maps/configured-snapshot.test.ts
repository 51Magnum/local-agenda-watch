import {afterEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({allowed:true}));
vi.mock("../jurisdictions/registry",async original=>{const actual=await original<typeof import("../jurisdictions/registry")>();return {...actual,jurisdiction:(id:string)=>id==="configured-fixture"?{enabled:true,legacyPublic:false}:actual.jurisdiction(id),isPublicJurisdiction:(id:string)=>id==="configured-fixture"?state.allowed:actual.isPublicJurisdiction(id)};});
vi.mock("../jurisdictions/runtime",()=>({configuredSnapshot:vi.fn(async()=>({version:1,jurisdiction:"configured-fixture",updatedAt:"2026-10-28",warnings:[],cases:[{id:"202601753-CU",title:"Grouped source project",geometry:{type:"MultiPolygon",coordinates:[]},confidence:"exact",sourceUrl:"https://official.test/query?where=case"}]}))}));
import {buildMapSnapshot} from "./refresh";
import {JURISDICTIONS} from "./jurisdictions";
import {configuredSnapshot} from "../jurisdictions/runtime";
afterEach(()=>{state.allowed=true;vi.unstubAllGlobals();vi.clearAllMocks();});
it("uses grouped scoped staging after normal approval rather than reintroducing historic raw GIS rows",async()=>{
 const fetch=vi.fn();vi.stubGlobal("fetch",fetch);const loadCases=vi.fn(),config={...JURISDICTIONS.nampa,id:"configured-fixture",caseGeometry:{...JURISDICTIONS.nampa.caseGeometry,layers:["https://official.test/all-historic-permits"]},loadCases,flum:{...JURISDICTIONS.nampa.flum,layerUrl:""}};
 const snapshot=await buildMapSnapshot(config);expect(snapshot.cases.map(c=>c.id)).toEqual(["202601753-CU"]);expect(snapshot.cases[0].geometry?.type).toBe("MultiPolygon");expect(configuredSnapshot).toHaveBeenCalledWith("configured-fixture");expect(fetch).not.toHaveBeenCalled();expect(loadCases).not.toHaveBeenCalled();
});
it("does not grant public-map access to a private configured jurisdiction",async()=>{
 state.allowed=false;await expect(buildMapSnapshot({...JURISDICTIONS.nampa,id:"configured-fixture"})).rejects.toThrow("not available for public maps");expect(configuredSnapshot).not.toHaveBeenCalled();
});
