import { expect,it,vi,afterEach } from "vitest";
import sharp from "sharp";
import { extractImages,getDocumentProxy,renderPageAsImage } from "unpdf";
import { extractDocumentVisual,documentPreview,previewCandidate,refreshCaseVisual } from "./visuals";
import { readVisualAsset,saveVisualAsset } from "./visual-store";
import { publicMapData } from "./refresh";
import { JURISDICTIONS } from "./jurisdictions";
import type { Hearing } from "../localities/types";
import type { MapSnapshot } from "./types";
vi.mock("unpdf",()=>({extractImages:vi.fn(),getDocumentProxy:vi.fn(),renderPageAsImage:vi.fn(),definePDFJSModule:vi.fn().mockResolvedValue(undefined)}));
vi.mock("./visual-store",()=>({readVisualAsset:vi.fn(),saveVisualAsset:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
it("accepts public image files and plan/report PDFs, excluding attendance sheets",()=>{
  expect(previewCandidate("Site photo.jpg ")).toBe(true);expect(previewCandidate("Staff Report.pdf")).toBe(true);
  expect(previewCandidate("Neighborhood sign in sheet.pdf")).toBe(false);expect(previewCandidate("Sign-in.png ")).toBe(false);
});
it("extracts a large PDF image with its actual source page and skips a small logo",async()=>{
  const destroy=vi.fn();vi.mocked(getDocumentProxy).mockResolvedValue({numPages:2,getPage:async(n:number)=>({getTextContent:async()=>({items:[{str:n===1?"Site plan":"Aerial map"}]})}),destroy} as never);
  vi.mocked(extractImages).mockResolvedValueOnce([{data:new Uint8ClampedArray(30*30*3),width:30,height:30,channels:3,key:"logo"}]).mockResolvedValueOnce([{data:new Uint8ClampedArray(500*400*3).fill(180),width:500,height:400,channels:3,key:"map"}]);
  const png=await sharp({create:{width:500,height:400,channels:3,background:"white"}}).png().toBuffer();vi.mocked(renderPageAsImage).mockResolvedValue(new Uint8Array(png).buffer as never);
  const result=await extractDocumentVisual(new TextEncoder().encode("%PDF-1.7"),"Staff report.pdf");expect(result?.page).toBe(2);expect((await sharp(result!.image).metadata()).format).toBe("webp");expect(destroy).toHaveBeenCalled();
});
it("uses the content hash cache without parsing unchanged files again",async()=>{
  vi.mocked(readVisualAsset).mockResolvedValue({image:"cached",page:15});
  const visual=await documentPreview("nampa",new Uint8Array([1,2,3]),"Site plan.pdf","https://city.test/report.pdf");
  expect(visual?.sourceUrl).toBe("https://city.test/report.pdf#page=15");expect(visual?.src).toMatch(/^\/api\/maps\/nampa\/visual\/[a-f0-9]{64}$/);expect(getDocumentProxy).not.toHaveBeenCalled();expect(saveVisualAsset).not.toHaveBeenCalled();
});
it("never downloads a private or attendance attachment while looking for a preview",async()=>{
  const download=vi.fn();const config={...JURISDICTIONS.nampa,recordClient:{getPlanAttachments:async()=>[{AttachmentID:"a",FileName:"Site plan.pdf",IsFileSecure:true},{AttachmentID:"b",FileName:"Neighborhood sign-in.png",IsFileSecure:false}],downloadPublicAttachment:download}};
  const hearing={appId:"ANN-12345-2026",energovPlanId:"plan",meetings:[]} as unknown as Hearing;
  expect(await refreshCaseVisual(config as never,hearing,Date.now()+30000)).toBeUndefined();expect(download).not.toHaveBeenCalled();
});
it("preserves automatically cached visuals when no curated image overrides them",()=>{
  const visual={src:"/api/maps/nampa/visual/abc",fullSizeUrl:"/api/maps/nampa/visual/abc",sourceUrl:"https://city.test/plan.pdf",label:"City file image",alt:"Plan",kind:"context" as const};
  const snapshot={jurisdiction:"nampa",updatedAt:"",cases:[{id:"ANN-12345-2026",href:"/us/id/nampa/plan/ANN-12345-2026",visual}],warnings:[]} as unknown as MapSnapshot;
  expect(publicMapData(JURISDICTIONS.nampa,snapshot).cases[0].visual).toEqual(visual);
});
