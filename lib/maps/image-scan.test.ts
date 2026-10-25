import {expect,it,vi,beforeEach} from "vitest";
import sharp from "sharp";
import {getDocumentProxy,renderPageAsImage} from "unpdf";
import {scanDocumentVisuals,pageCaption,pageSourceDate,graphicsScore} from "./image-scan";
import {classifyImagePage} from "./classify-image";
import {IMAGE_CHECK_VERSION} from "./image-policy";
vi.mock("unpdf",()=>({getDocumentProxy:vi.fn(),renderPageAsImage:vi.fn(),definePDFJSModule:vi.fn().mockResolvedValue(undefined)}));
vi.mock("./classify-image",()=>({classifyImagePage:vi.fn()}));
beforeEach(()=>vi.clearAllMocks());
it("uses captions anywhere without rejecting an entire page for a narrative reference to notices",()=>{
 expect(pageCaption(["Plan notes", "Notice to contractor: dimensions", "PROPOSED SITE PLAN"])).toBe("PROPOSED SITE PLAN");
 expect(pageCaption(["Neighborhood Meeting Sign-in Sheet","Site plan exhibit"])).toMatch(/Sign-in/);
 expect(graphicsScore("",{fnArray:[1,2],argsArray:[[612,0,0,792,0,0],[]]},{transform:1,paintImageXObject:2})).toBe(380);
});
it("scans beyond page 40 and finds a graphics-only exhibit without text, sending at most 8 pages to vision",async()=>{
 const {OPS}=await import("pdfjs-dist/legacy/build/pdf.mjs");
 vi.mocked(getDocumentProxy).mockResolvedValue({numPages:160,getPage:async(n:number)=>({getTextContent:async()=>({items:n===154?[{str:"Site plan exhibit follows"}]:[]}),getOperatorList:async()=>({fnArray:n>=155?[OPS.transform,OPS.paintImageXObject]:[],argsArray:n>=155?[[612,0,0,792,0,0],["image",2200,3300]]:[]}),cleanup:()=>{}}),destroy:async()=>{}} as never);
 const png=await sharp({create:{width:200,height:180,channels:3,background:"white"}}).png().toBuffer();vi.mocked(renderPageAsImage).mockResolvedValue(new Uint8Array(png).buffer as never);
 vi.mocked(classifyImagePage).mockResolvedValue({version:IMAGE_CHECK_VERSION,type:"site plan",contains_personal_info:false,confidence:.95,pageHash:"a".repeat(64),checkedAt:"2026-10-24"});
 const candidates:number[]=[];const result=await scanDocumentVisuals(new TextEncoder().encode("%PDF-1.7"),"Staff report",{deadline:Date.now()+60000,candidate:async c=>{candidates.push(c.page!);}});
 expect(result.complete).toBe(true);expect(result.progress.nextPage).toBe(161);expect(candidates).toContain(155);expect(candidates.length).toBeLessThanOrEqual(8);
});
it("does not mark a timed-out scan complete",async()=>{
 vi.mocked(getDocumentProxy).mockResolvedValue({numPages:90,destroy:async()=>{}} as never);
 const result=await scanDocumentVisuals(new TextEncoder().encode("%PDF-1.7"),"Staff report",{deadline:Date.now()-1});expect(result.complete).toBe(false);expect(result.progress.nextPage).toBe(1);expect(classifyImagePage).not.toHaveBeenCalled();
});

it("uses a drawing's explicit date before the containing report's date",()=>{
 expect(pageSourceDate(["Site Plan","July 6, 2026"])).toBe("2026-07-06");expect(pageSourceDate(["Date: 09/29/2026"])).toBe("2026-09-29");expect(pageSourceDate(["Hearing may be held next month"])).toBeUndefined();
});

it("isolates packet sections using the area's case IDs rather than one city's numbering scheme",async()=>{
 const {OPS}=await import("pdfjs-dist/legacy/build/pdf.mjs");vi.mocked(getDocumentProxy).mockResolvedValue({numPages:4,getPage:async(n:number)=>({getTextContent:async()=>({items:n===1?[{str:"26-04-PP"}]:n===3?[{str:"26-05-PP"}]:[{str:"Site plan"}]}),getOperatorList:async()=>({fnArray:[OPS.transform,OPS.paintImageXObject],argsArray:[[612,0,0,792,0,0],["img",2200,3300]]}),cleanup:()=>{}}),destroy:async()=>{}} as never);
 const result=await scanDocumentVisuals(new TextEncoder().encode("%PDF-1.7"),"Meeting packet",{deadline:Date.now()+60000,analyzeOnly:true,packet:true,caseId:"26-04-PP",packetCaseIds:["26-04-PP","26-05-PP"]});expect(result.progress.candidates.map(c=>c.page)).toContain(2);expect(result.progress.candidates.map(c=>c.page)).not.toContain(4);
});
