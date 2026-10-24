import { expect,it,vi,afterEach } from "vitest";
import sharp from "sharp";
import { getDocumentProxy,renderPageAsImage } from "unpdf";
import { extractDocumentVisual,documentPreview,previewCandidate,refreshCaseVisual } from "./visuals";
import { classifyImagePage } from "./classify-image";
import { readVisualAsset,saveVisualAsset } from "./visual-store";
import { publicMapData } from "./refresh";
import { JURISDICTIONS } from "./jurisdictions";
import { IMAGE_CHECK_VERSION } from "./image-policy";
import type { Hearing } from "../localities/types";
import type { MapSnapshot } from "./types";
vi.mock("unpdf",()=>({getDocumentProxy:vi.fn(),renderPageAsImage:vi.fn(),definePDFJSModule:vi.fn().mockResolvedValue(undefined)}));
vi.mock("./visual-store",()=>({readVisualAsset:vi.fn(),saveVisualAsset:vi.fn()}));
vi.mock("./classify-image",()=>({classifyImagePage:vi.fn()}));
const check={version:IMAGE_CHECK_VERSION,pageHash:"a".repeat(64),type:"concept plan",contains_personal_info:false,confidence:.95,checkedAt:"2026-10-24",sourceDate:"2026-03"};
afterEach(()=>vi.resetAllMocks());
it("allowlists plan titles and never accepts arbitrary photos, staff text, forms, or neighborhood sheets",()=>{
 for(const title of ["Site photo.jpg","Staff Report.pdf","Neighborhood Meeting Site Plan.pdf","Sign-in.png","Application concept.pdf","Affidavit exhibit.pdf","Comment letter.pdf"])expect(previewCandidate(title)).toBe(false);
 for(const title of ["Site plan.pdf","Concept plan.png","Building elevation.pdf","Landscape plan.pdf","Aerial exhibit.pdf"])expect(previewCandidate(title)).toBe(true);
});
it("classifies the full source page and skips a rejected staff text page before a real exhibit",async()=>{
 const destroy=vi.fn();vi.mocked(getDocumentProxy).mockResolvedValue({numPages:2,getPage:async(n:number)=>({getTextContent:async()=>({items:[{str:n===1?"Site plan narrative review text":"Aerial exhibit"}]})}),destroy} as never);
 const png=await sharp({create:{width:500,height:400,channels:3,background:"white"}}).png().toBuffer();vi.mocked(renderPageAsImage).mockResolvedValue(new Uint8Array(png).buffer as never);
 vi.mocked(classifyImagePage).mockResolvedValueOnce({...check,type:"rejected",confidence:1}).mockResolvedValueOnce({...check,type:"vicinity/aerial exhibit"});
 const result=await extractDocumentVisual(new TextEncoder().encode("%PDF-1.7"),"Staff report.pdf");expect(result?.page).toBe(2);expect(classifyImagePage).toHaveBeenCalledTimes(2);expect(destroy).toHaveBeenCalled();
});
it("keeps Braeburn's concept only after a privacy check and captions the real type/date",async()=>{
 const png=await sharp({create:{width:500,height:400,channels:3,background:"white"}}).png().toBuffer();vi.mocked(classifyImagePage).mockResolvedValue(check);
 const visual=await documentPreview("nampa",png,"Braeburn concept plan March 2026.png","https://city.test/concept.png");
 expect(visual?.label).toBe("Concept plan · Mar 2026");expect(visual?.approval).toEqual(check);expect(saveVisualAsset).toHaveBeenCalled();
});
it("uses only a checked asset cache without parsing unchanged files again",async()=>{
 vi.mocked(readVisualAsset).mockResolvedValue({image:"cached",page:15,approval:check});
 const visual=await documentPreview("nampa",new Uint8Array([1,2,3]),"Site plan.pdf","https://city.test/report.pdf");
 expect(visual?.sourceUrl).toBe("https://city.test/report.pdf#page=15");expect(getDocumentProxy).not.toHaveBeenCalled();expect(classifyImagePage).not.toHaveBeenCalled();
});
it("a duplex CUP's sign-in sheet never renders or calls the classifier even when labeled an exhibit",async()=>{
 expect(await documentPreview("nampa",new Uint8Array([1,2,3]),"CUP-00415-2026 Neighborhood Meeting Sign-in Sheet exhibit.pdf","https://city.test/sheet.pdf")).toBeUndefined();
 expect(classifyImagePage).not.toHaveBeenCalled();expect(saveVisualAsset).not.toHaveBeenCalled();
});
it("rejects a plan-looking page containing personal information and uncertain pages",async()=>{
 const png=await sharp({create:{width:500,height:400,channels:3,background:"white"}}).png().toBuffer();
 for(const result of [{...check,contains_personal_info:true},{...check,confidence:.79},{...check,type:"rejected"}]){vi.mocked(classifyImagePage).mockResolvedValue(result);expect(await extractDocumentVisual(png,"Concept plan.png")).toBeUndefined();}
});
it("never downloads private, attendance or application attachments",async()=>{
 const download=vi.fn();const config={...JURISDICTIONS.nampa,recordClient:{getPlanAttachments:async()=>[{AttachmentID:"a",FileName:"Site plan.pdf",IsFileSecure:true},{AttachmentID:"b",FileName:"Neighborhood sign-in.png",IsFileSecure:false}],downloadPublicAttachment:download}};
 expect(await refreshCaseVisual(config as never,{appId:"CUP-00415-2026",energovPlanId:"plan",meetings:[]} as unknown as Hearing,Date.now()+90000)).toBeUndefined();expect(download).not.toHaveBeenCalled();
});
it("never trusts old snapshot/curated images without the checked publication catalog",()=>{
 const visual={src:"/api/maps/nampa/visual/abc",fullSizeUrl:"/api/maps/nampa/visual/abc",sourceUrl:"https://city.test/plan.pdf",label:"City file image",alt:"Plan",kind:"context" as const};
 const snapshot={jurisdiction:"nampa",updatedAt:"",cases:[{id:"CUP-00415-2026",href:"/us/id/nampa/plan/CUP-00415-2026",visual}],warnings:[]} as unknown as MapSnapshot;
 expect(publicMapData(JURISDICTIONS.nampa,snapshot).cases[0].visual).toBeUndefined();
});
