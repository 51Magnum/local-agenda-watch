import { beforeEach,expect,it,vi } from "vitest";
import { classifyImagePage } from "./classify-image";
import { structuredResponse } from "@/lib/timeline/extract";
import { readImageCheck,saveImageCheck,reserveImageCheck } from "./image-review-store";
import type { ImageCheck } from "./image-policy";
vi.mock("@/lib/timeline/extract",()=>({structuredResponse:vi.fn()}));
vi.mock("./image-review-store",()=>({readImageCheck:vi.fn(),saveImageCheck:vi.fn(),reserveImageCheck:vi.fn()}));
beforeEach(()=>{vi.resetAllMocks();const cache=new Map<string,ImageCheck>();vi.mocked(readImageCheck).mockImplementation(async id=>cache.get(id));vi.mocked(saveImageCheck).mockImplementation(async(id,v)=>{cache.set(id,v);});vi.mocked(reserveImageCheck).mockImplementation(async(id,v)=>{if(cache.has(id))return false;cache.set(id,v);return true;});});
it("uses high-detail vision and reuses its result for an unchanged page",async()=>{
 vi.mocked(structuredResponse).mockResolvedValue({type:"concept plan",contains_personal_info:false,contains_handwriting:false,contains_signatures:false,is_context_map:false,is_plan_or_map:true,confidence:.94});
 const bytes=new Uint8Array([123,44,1]);const a=await classifyImagePage(bytes,"Concept plan"),b=await classifyImagePage(bytes,"Concept plan");expect(a).toEqual(b);expect(structuredResponse).toHaveBeenCalledTimes(1);
 expect(vi.mocked(structuredResponse).mock.calls[0][2][1]).toMatchObject({type:"input_image",detail:"high"});
});
it("fails closed and caches errors rather than repeatedly calling the model",async()=>{
 vi.mocked(structuredResponse).mockRejectedValue(new Error("unavailable"));const bytes=new Uint8Array([22,33]);expect((await classifyImagePage(bytes,"Site plan")).contains_personal_info).toBe(true);await classifyImagePage(bytes,"Site plan");expect(structuredResponse).toHaveBeenCalledTimes(1);
});
it("never sends a forbidden document to the model",async()=>{await classifyImagePage(new Uint8Array([1]),"Neighborhood Meeting Sign-in Sheet exhibit");expect(structuredResponse).not.toHaveBeenCalled();});

it("retries an unavailable classification after 24 hours",async()=>{
 vi.mocked(readImageCheck).mockResolvedValue({version:"privacy-allowlist-v1",pageHash:"a".repeat(64),type:"classification unavailable",contains_personal_info:true,confidence:0,checkedAt:new Date(Date.now()-86400001).toISOString(),attempts:1});
 vi.mocked(reserveImageCheck).mockResolvedValue(true);vi.mocked(structuredResponse).mockResolvedValue({type:"site plan",contains_personal_info:false,contains_handwriting:false,contains_signatures:false,is_context_map:false,is_plan_or_map:true,confidence:.95});
 const check=await classifyImagePage(new Uint8Array([6,7]),"Site plan");expect(check.type).toBe("site plan");expect(check.attempts).toBe(2);expect(structuredResponse).toHaveBeenCalledTimes(1);
});

it("rejects handwriting and corrects context maps even if a model calls them site plans",async()=>{
 const result={type:"site plan",contains_personal_info:false,contains_handwriting:true,contains_signatures:false,is_context_map:false,is_plan_or_map:true,confidence:.99};vi.mocked(structuredResponse).mockResolvedValueOnce(result).mockResolvedValueOnce({...result,contains_handwriting:false,is_context_map:true});
 expect((await classifyImagePage(new Uint8Array([98]),"Site plan")).type).toBe("rejected");expect((await classifyImagePage(new Uint8Array([99]),"Aerial exhibit")).type).toBe("vicinity/aerial exhibit");
});
