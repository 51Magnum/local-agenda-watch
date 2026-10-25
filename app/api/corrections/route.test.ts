import {beforeEach,expect,it,vi} from "vitest";
vi.mock("@/lib/corrections",()=>({saveCorrection:vi.fn(async()=>({limited:false,id:"test-id"}))}));
import {saveCorrection} from "@/lib/corrections";
import {POST} from "./route";
const request=(body:unknown,origin="https://example.test")=>new Request("https://example.test/api/corrections",{method:"POST",headers:{origin,"Content-Type":"application/json","x-forwarded-for":"203.0.113.2"},body:JSON.stringify(body)});
beforeEach(()=>vi.clearAllMocks());
it("stores a prefilled project and optional reply email",async()=>{const r=await POST(request({project:"nampa/CUP-00412-2026",message:"Address should be private",email:""}));expect(r.status).toBe(201);expect(saveCorrection).toHaveBeenCalledWith({project:"nampa/CUP-00412-2026",message:"Address should be private",email:null},"203.0.113.2");});
it("silently discards honeypots and rejects cross-origin or invalid submissions",async()=>{expect((await POST(request({website:"bot"}))).status).toBe(201);expect((await POST(request({project:"p",message:"error report"},"https://evil.test"))).status).toBe(403);expect((await POST(request({project:"p",message:"no"}))).status).toBe(400);expect(saveCorrection).not.toHaveBeenCalled();});
it("returns an explicit rate-limit response",async()=>{vi.mocked(saveCorrection).mockResolvedValueOnce({limited:true});expect((await POST(request({project:"p",message:"Wrong hearing date"}))).status).toBe(429);});
