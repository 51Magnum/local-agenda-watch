import {beforeEach,afterEach,expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({save:vi.fn(),path:vi.fn(),tag:vi.fn()}));
vi.mock("@/lib/maps/manual-image-crop",()=>({saveManualImageCrop:h.save}));
vi.mock("next/cache",()=>({revalidatePath:h.path,revalidateTag:h.tag}));
import {POST} from "./route";
const origin="https://law.test",auth="Basic "+Buffer.from("admin:fixture-password").toString("base64"),box={left:20,top:30,width:100,height:200};
const request=(body:unknown,authorization=auth,source=origin)=>new Request(origin+"/admin/images/crop/action",{method:"POST",headers:{authorization,origin:source,"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("REVIEW_ADMIN_PASSWORD","fixture-password");vi.clearAllMocks();h.save.mockResolvedValue({areaId:"nampa",manual:true,box});});afterEach(()=>vi.unstubAllEnvs());
it("guards crop writes with existing admin auth, same-origin and Preview protection",async()=>{
 expect((await POST(request({},""))).status).toBe(401);expect((await POST(request({},auth,"https://evil.test"))).status).toBe(403);vi.stubEnv("VERCEL_ENV","preview");expect((await POST(request({})))).toHaveProperty("status",403);expect(h.save).not.toHaveBeenCalled();
});
it("saves a confirmed crop through the privacy pipeline and invalidates existing public paths",async()=>{
 const response=await POST(request({id:"review",box,sourcePageHash:"a".repeat(64),action:"save",confirmed:true}));expect(response.status).toBe(200);expect(h.save).toHaveBeenCalledWith("review",box,"admin",false,"a".repeat(64));expect(h.path).toHaveBeenCalledWith("/","layout");expect(response.headers.get("cache-control")).toContain("private, no-store");
});
it("reset uses the same service and privacy gate, while failed checks retain the existing image",async()=>{
 expect((await POST(request({id:"review",sourcePageHash:"a".repeat(64),action:"reset",confirmed:true}))).status).toBe(200);expect(h.save).toHaveBeenCalledWith("review",undefined,"admin",true,"a".repeat(64));
 h.save.mockRejectedValueOnce(Error("Personal data found at private address"));const response=await POST(request({id:"review",box,sourcePageHash:"a".repeat(64),action:"save",confirmed:true}));expect(response.status).toBe(409);expect(await response.text()).not.toContain("private address");
});
it("rejects missing confirmation, unknown actions and oversized input before any write",async()=>{
 for(const data of [{id:"review",box,sourcePageHash:"a".repeat(64),action:"save"},{id:"review",action:"publish",confirmed:true},{id:"x".repeat(5000),action:"save",confirmed:true}])expect((await POST(request(data))).status).toBe(400);expect(h.save).not.toHaveBeenCalled();
});
