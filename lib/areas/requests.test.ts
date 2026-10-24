import {afterEach,beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({query:vi.fn(),readFile:vi.fn(),writeFile:vi.fn(),rename:vi.fn()}));
vi.mock("pg",()=>({Pool:class{query=mocks.query;}}));
vi.mock("node:fs/promises",()=>({mkdir:vi.fn(),readFile:mocks.readFile,writeFile:mocks.writeFile,rename:mocks.rename}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();vi.stubEnv("VERCEL","");vi.stubEnv("DATABASE_URL","");});
afterEach(()=>vi.unstubAllEnvs());
it("keeps legacy local entries and lists newest submissions with filters and pagination",async()=>{
 const items=Array.from({length:55},(_,i)=>({kind:i%2?"coverage":"follow",areaRequested:"Example",email:null,location:null,createdAt:new Date(Date.UTC(2026,9,1,0,i)).toISOString()}));
 mocks.readFile.mockResolvedValue(JSON.stringify(items));const {listCoverageRequests}=await import("./requests");
 const second=await listCoverageRequests({page:2});expect(second.items).toHaveLength(5);expect(second.total).toBe(55);expect(second.items[0].createdAt).toBe(items[4].createdAt);expect(second.items[0].address).toBeUndefined();
 const follow=await listCoverageRequests({kind:"follow"});expect(follow.total).toBe(28);expect(follow.items.every(x=>x.kind==="follow")).toBe(true);
});
it("migrates existing Neon tables without replacing rows and parameterizes submitted details",async()=>{
 vi.stubEnv("DATABASE_URL","postgres://test.invalid/db");mocks.query.mockResolvedValue({rows:[]});
 const {saveCoverageRequest}=await import("./requests");await saveCoverageRequest({kind:"follow",areaRequested:"Example",email:"test@example.test",address:"Main & First",interests:"Housing",location:null,createdAt:"2026-10-24T02:00:00Z"});
 expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("ADD COLUMN IF NOT EXISTS address"));
 const insert=mocks.query.mock.calls.find(([sql])=>sql.startsWith("INSERT"))!;
 expect(insert[0]).not.toContain("test@example.test");expect(insert[1].slice(-2)).toEqual(["Main & First","Housing"]);
});
it("reads legacy database rows and safely filters the private admin list",async()=>{
 vi.stubEnv("DATABASE_URL","postgres://test.invalid/db");mocks.query.mockImplementation(async(sql:string)=>({rows:sql.startsWith("SELECT count")?[{all:1,follow:1,coverage:0}]:sql.startsWith("SELECT id")?[{id:"old",kind:"follow",area_requested:"Any area",email:"test@example.test",created_at:new Date("2026-10-01"),address:null,interests:null,latitude:null,longitude:null}]:[]}));
 const {listCoverageRequests}=await import("./requests");const result=await listCoverageRequests({kind:"follow"});expect(result.items[0]).toMatchObject({id:"old",address:null,interests:null});expect(result.total).toBe(1);
 expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("WHERE ($1::text IS NULL OR kind=$1)"),["follow",50,0]);
});

it("resolves a saved radius across both city and county, including legacy coordinate-only follows",async()=>{
 const {withRadiusScope}=await import("./requests");
 const saved=withRadiusScope({kind:"follow" as const,areaRequested:"Near Victory / Happy Valley",email:"test@example.test",location:{lat:43.5756774,lng:-116.5099174},createdAt:"2026-10-24"});
 expect(saved).toMatchObject({radiusMiles:1,jurisdictionScope:"radius",jurisdictions:expect.arrayContaining(["nampa","canyon-county"])});
});
