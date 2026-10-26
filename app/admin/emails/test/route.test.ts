import {afterEach,expect,it,vi} from "vitest";
vi.mock("@/lib/email/examples",()=>({loadEmailExamples:async()=>[{id:"confirmation-project",message:{subject:"Confirm project",preheader:"Preview",html:"<!doctype html><p>Preview</p>",text:"Preview"}}]}));
vi.mock("@/lib/alerts",()=>({sendAlertMail:vi.fn().mockResolvedValue("test-message")}));
import {POST} from "./route";
import {sendAlertMail} from "@/lib/alerts";
const request=(body:unknown,admin=true)=>new Request("https://preview.test/admin/emails/test",{method:"POST",headers:{"Content-Type":"application/json",origin:"https://preview.test",...(admin?{authorization:"Basic "+Buffer.from("admin:test-password").toString("base64")}: {})},body:JSON.stringify(body)});
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it("sends a test only to the explicit admin-entered address and ignores client-supplied HTML",async()=>{
 vi.stubEnv("REVIEW_ADMIN_PASSWORD","test-password");
 expect((await POST(request({to:"owner@example.test",template:"confirmation-project",html:"untrusted client content"}))).status).toBe(200);
 expect(sendAlertMail).toHaveBeenCalledOnce();expect(sendAlertMail).toHaveBeenCalledWith(expect.objectContaining({to:"owner@example.test",mode:"test",html:"<!doctype html><p>Preview</p>"}));
});
it("rejects unauthenticated tests and recipient lists",async()=>{
 vi.stubEnv("REVIEW_ADMIN_PASSWORD","test-password");
 expect((await POST(request({to:"owner@example.test",template:"confirmation-project"},false))).status).toBe(403);
 expect((await POST(request({to:["one@example.test","two@example.test"],template:"confirmation-project"}))).status).toBe(400);expect(sendAlertMail).not.toHaveBeenCalled();
});
