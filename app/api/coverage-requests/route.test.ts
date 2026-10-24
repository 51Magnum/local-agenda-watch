import{afterEach,expect,it,vi}from"vitest";
import{POST}from"./route";
import{saveCoverageRequest}from"@/lib/areas/requests";
vi.mock("@/lib/areas/requests",()=>({saveCoverageRequest:vi.fn()}));afterEach(()=>vi.resetAllMocks());
function request(data:object){return new Request("http://localhost/api/coverage-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});}
it("saves an uncovered Boise request with optional email and only the permitted fields",async()=>{const r=await POST(request({kind:"coverage",areaRequested:"Boise, ID",location:{lat:43.615,lng:-116.2023},email:"",ip:"do-not-store",name:"do-not-store"}));expect(r.status).toBe(201);expect(saveCoverageRequest).toHaveBeenCalledWith({kind:"coverage",areaRequested:"Boise, ID",location:{lat:43.615,lng:-116.2023},email:null,address:null,interests:null,createdAt:expect.any(String)});});
it("stores follow interest in the same schema without signing anyone up for alerts",async()=>{expect((await POST(request({kind:"follow",areaRequested:"Any area",email:"neighbor@example.test"}))).status).toBe(201);expect(saveCoverageRequest).toHaveBeenCalledWith(expect.objectContaining({kind:"follow",location:null,email:"neighbor@example.test"}));});
it("rejects invalid email or coordinates without writing",async()=>{for(const data of [{kind:"coverage",areaRequested:"Boise",email:"invalid"},{kind:"coverage",areaRequested:"Boise",location:{lat:150,lng:0}}])expect((await POST(request(data))).status).toBe(400);expect(saveCoverageRequest).not.toHaveBeenCalled();});
it("reports storage failures without logging the submitted address or email",async()=>{vi.mocked(saveCoverageRequest).mockRejectedValue(new Error("offline"));expect((await POST(request({kind:"coverage",areaRequested:"Boise"}))).status).toBe(503);});
it("rejects malformed JSON and null bodies without writing",async()=>{for(const body of ["{","null","[]"]){expect((await POST(new Request("http://localhost/api/coverage-requests",{method:"POST",body}))).status).toBe(400);}expect(saveCoverageRequest).not.toHaveBeenCalled();});

it("saves an explicit area, optional location text, and interests without geocoding or adding other identity fields",async()=>{
 const response=await POST(request({kind:"follow",areaRequested:" Meridian, ID ",address:" Franklin & Eagle ",interests:" New housing and public hearings ",email:"neighbor@example.test",name:"Ignore me"}));
 expect(response.status).toBe(201);expect(saveCoverageRequest).toHaveBeenCalledWith({kind:"follow",areaRequested:"Meridian, ID",address:"Franklin & Eagle",interests:"New housing and public hearings",email:"neighbor@example.test",location:null,createdAt:expect.any(String)});
});
it("rejects oversized and non-text location/interest fields",async()=>{
 for(const fields of [{address:"x".repeat(301)},{interests:"x".repeat(1001)},{address:{text:"private"}},{interests:["housing"]}]){
 expect((await POST(request({kind:"follow",areaRequested:"Example",email:"neighbor@example.test",...fields}))).status).toBe(400);
 }
 expect(saveCoverageRequest).not.toHaveBeenCalled();
});
it("rejects cross-origin submissions and quietly ignores honeypot entries",async()=>{
 const response=await POST(new Request("https://example.test/api/coverage-requests",{method:"POST",headers:{Origin:"https://other.test"},body:JSON.stringify({kind:"follow",areaRequested:"Example"})}));expect(response.status).toBe(403);
 expect((await POST(request({kind:"follow",areaRequested:"Example",website:"spam"}))).status).toBe(200);expect(saveCoverageRequest).not.toHaveBeenCalled();
});

it("requires email for the alert waitlist while keeping coverage requests anonymous",async()=>{
 expect((await POST(request({kind:"follow",areaRequested:"Example",email:""}))).status).toBe(400);expect(saveCoverageRequest).not.toHaveBeenCalled();
 expect((await POST(request({kind:"coverage",areaRequested:"Example",email:""}))).status).toBe(201);
});

it("saves a place radius rather than restricting the follow to one jurisdiction",async()=>{
 const r=await POST(request({kind:"follow",areaRequested:"Victory / Happy Valley",email:"neighbor@example.test",location:{lat:43.5756774,lng:-116.5099174},radiusMiles:2}));
 expect(r.status).toBe(201);expect(saveCoverageRequest).toHaveBeenCalledWith(expect.objectContaining({radiusMiles:2,jurisdictionScope:"radius"}));
});
it("rejects invalid radius values before saving",async()=>{
 for(const radiusMiles of [0,11,"1"]){expect((await POST(request({kind:"follow",areaRequested:"Example",email:"neighbor@example.test",radiusMiles}))).status).toBe(400);}
 expect(saveCoverageRequest).not.toHaveBeenCalled();
});
