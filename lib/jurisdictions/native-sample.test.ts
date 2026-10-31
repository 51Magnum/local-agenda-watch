import {expect,it,vi} from "vitest";
vi.mock("../timeline/extract",()=>({extractNativePdfChunk:vi.fn().mockImplementation(async(_bytes,{maxPages})=>({pages:Array.from({length:maxPages},(_,i)=>({page:i+1,text:"Official report text for this application and its proposal.",method:"native"})),nextPage:maxPages+1,totalPages:20}))}));
import {extractNativePdfChunk} from "../timeline/extract";
import {nativeSampleAllowed,readNativeSample} from "./native-sample";
import {jurisdiction} from "./registry";
import type {SourceHttp} from "./http";
const d=jurisdiction("ada-county"),report={title:"Staff report",kind:"staff_report" as const,url:"https://official.test/report.pdf",sizeBytes:53000000};
it("reads the first twelve pages of a report above the old byte cap with an explicit larger native-only download bound",async()=>{
 const request=vi.fn().mockResolvedValue({bytes:new TextEncoder().encode("%PDF-fixture")});
 expect(nativeSampleAllowed(report,d)).toBe(true);
 const result=await readNativeSample({request} as unknown as SourceHttp,report,d,Date.now()+220000);
 expect(request).toHaveBeenCalledWith(report.url,{},160000000);expect(extractNativePdfChunk).toHaveBeenCalledWith(expect.any(Uint8Array),expect.objectContaining({maxPages:12}));
 expect(result.pages).toHaveLength(12);expect(result.chunk.totalPages).toBe(20);expect(result.chunk.nextPage).toBe(13);
});
it("still rejects packets, attendance material and files above the native cap",()=>{
 expect(nativeSampleAllowed({...report,sizeBytes:160000001},d)).toBe(false);expect(nativeSampleAllowed({...report,title:"Attendance sign-in sheet"},d)).toBe(false);expect(nativeSampleAllowed({...report,kind:"packet"},d)).toBe(false);
});
