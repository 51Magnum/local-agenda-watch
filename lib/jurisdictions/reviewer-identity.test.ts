import {afterEach,expect,it,vi} from "vitest";
vi.mock("./store",async original=>({...await original<typeof import("./store")>(),approveQa:vi.fn().mockResolvedValue({id:"approval"})}));
vi.mock("../timeline/document-work-lease",()=>({claimDocumentWork:vi.fn(async()=>async()=>{})}));
import {reviewerIdentity,authorizedReviewer} from "../timeline/auth";
import {approveQa} from "./store";
import {POST as action} from "../../app/admin/jurisdictions/action/route";
import {POST as approval} from "../../app/admin/jurisdictions/approval/route";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const basic=(name:string)=>"Basic "+Buffer.from(name+":fixture-password").toString("base64");
it("derives the authenticated actor without widening the existing admin-only policy",()=>{
 expect(reviewerIdentity(basic("admin"),"fixture-password")).toBe("admin");expect(reviewerIdentity(basic("owner"),"fixture-password")).toBeUndefined();expect(authorizedReviewer(basic("owner"),"fixture-password")).toBe(false);expect(reviewerIdentity(basic("admin"),"wrong")).toBeUndefined();
});
it("passes the authenticated identity to both approval entrypoints",async()=>{
 vi.stubEnv("REVIEW_ADMIN_PASSWORD","fixture-password");const headers={authorization:basic("admin"),origin:"https://example.test"};
 const first=await action(new Request("https://example.test/admin/jurisdictions/action",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({command:"approve",areaId:"ada-county",qaId:"qa"})}));expect(first.status).toBe(200);
 const second=await approval(new Request("https://example.test/admin/jurisdictions/approval",{method:"POST",headers,body:new URLSearchParams({areaId:"ada-county",qaId:"qa"})}));expect(second.status).toBe(303);
 expect(approveQa).toHaveBeenNthCalledWith(1,"ada-county","qa","admin");expect(approveQa).toHaveBeenNthCalledWith(2,"ada-county","qa","admin");
});
