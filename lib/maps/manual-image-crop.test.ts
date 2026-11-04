import {beforeEach,afterEach,expect,it,vi} from "vitest";
import sharp from "sharp";
import {createHash} from "node:crypto";
import type {ImageReview} from "./image-review-store";
import type {VisualAsset} from "./visual-store";
const h=vi.hoisted(()=>({row:undefined as unknown as ImageReview,assets:new Map<string,VisualAsset>(),classify:vi.fn(),save:vi.fn(),update:vi.fn(),residential:vi.fn()}));
vi.mock("./image-review-store",()=>({readImageReview:async()=>structuredClone(h.row),imageReviews:async()=>[h.row],updateImageCrop:h.update}));
vi.mock("./visual-store",()=>({readVisualAsset:async(_area:string,id:string)=>h.assets.get(id),saveVisualAsset:h.save}));
vi.mock("./classify-image",()=>({classifyImagePage:h.classify}));
vi.mock("../jurisdictions/ai-budget",()=>({withJurisdictionAi:(_scope:unknown,fn:()=>Promise<unknown>)=>fn()}));
vi.mock("../residential-privacy-store",()=>({privacyOverrides:async()=>({})}));
vi.mock("../residential-privacy",()=>({residentialCase:h.residential}));
import {cropSource,saveManualImageCrop} from "./manual-image-crop";
import {validateCrop} from "./preview-crop";
const sourceId="a".repeat(64),box={left:40,top:50,width:300,height:200};
beforeEach(async()=>{
 vi.stubEnv("VERCEL_ENV","production");vi.clearAllMocks();h.assets.clear();h.residential.mockReturnValue(false);
 const bytes=await sharp(Buffer.from('<svg width="600" height="800"><rect width="600" height="800" fill="white"/><rect x="40" y="50" width="400" height="280" fill="#579bc9"/><rect x="40" y="500" width="400" height="240" fill="#6a9b6a"/></svg>')).webp().toBuffer(),approval={version:"privacy-allowlist-v1",pageHash:createHash("sha256").update(bytes).digest("hex"),type:"site plan",contains_personal_info:false,contains_handwriting:false,contains_signatures:false,confidence:.95,checkedAt:new Date().toISOString(),reviewerVersion:"vision-high-v2"};
 h.assets.set(sourceId,{image:bytes.toString("base64"),approval});h.row={id:"review",areaId:"nampa",caseIds:["ANN-00371-2026"],title:"Site plan",sourceUrl:"https://official.test/plan.pdf#page=2",originalSrc:"original",outcome:"accepted",checkedAt:"now",visual:{src:"/api/maps/nampa/visual/"+sourceId,fullSizeUrl:"/api/maps/nampa/visual/"+sourceId,sourceUrl:"https://official.test/plan.pdf#page=2",label:"Site plan",alt:"Site plan",kind:"proposal",approval}};
 h.classify.mockImplementation(async(bytes:Buffer)=>({...approval,pageHash:createHash("sha256").update(bytes).digest("hex")}));h.save.mockImplementation(async(_area:string,id:string,asset:VisualAsset)=>{h.assets.set(id,structuredClone(asset));});
 h.update.mockImplementation(async(_id:string,expected:string,visual:ImageReview["visual"],source:string,crop:ImageReview["manualCrop"])=>{expect(h.row.visual!.src).toBe(expected);h.row={...h.row,visual,cropSourceAssetId:source,manualCrop:crop,manual:true};});
});
afterEach(()=>vi.unstubAllEnvs());
it("creates a server-side crop, rechecks its exact bytes, stores the box, and preserves the full original page",async()=>{
 const original=h.assets.get(sourceId)!.image,result=await saveManualImageCrop("review",box,"admin"),asset=[...h.assets.entries()].find(([id])=>id!==sourceId)![1];
 expect(result.manual).toBe(true);expect(h.classify).toHaveBeenCalledTimes(1);expect(h.row.manualCrop).toMatchObject({box,sourceAssetId:sourceId,sourcePageHash:h.row.visual!.approval!.pageHash,actor:"admin"});expect(asset.image).toBe(original);expect(h.assets.get(sourceId)!.image).toBe(original);expect(asset.preview).toMatchObject({manual:true,crop:box});expect(asset.preview!.approval!.pageHash).toBe(asset.preview!.hash);expect((await sharp(Buffer.from(asset.preview!.image,"base64")).metadata()).width).toBe(300);
});
it("reset rebuilds the auto crop from the original page and repeats the privacy gate",async()=>{
 await saveManualImageCrop("review",box,"admin");const result=await saveManualImageCrop("review",undefined,"admin",true);expect(result.manual).toBe(false);expect(h.row.manualCrop).toBeUndefined();expect(h.classify).toHaveBeenCalledTimes(2);expect(result.box.height).toBeGreaterThan(box.height);expect((await cropSource("review")).sourceAssetId).toBe(sourceId);
});
it("labels a context-map crop according to its own classification while retaining the full-page approval",async()=>{
 const original=h.row.visual!.approval!.pageHash;h.classify.mockImplementation(async(bytes:Buffer)=>({...h.assets.get(sourceId)!.approval!,pageHash:createHash("sha256").update(bytes).digest("hex"),type:"vicinity/aerial exhibit",is_context_map:true}));
 await saveManualImageCrop("review",box,"admin");expect(h.row.visual).toMatchObject({kind:"context",label:"Vicinity/aerial exhibit",previewApproval:{type:"vicinity/aerial exhibit"},approval:{pageHash:original,type:"site plan"}});
});
it.each([{...box,left:-1},{...box,width:0},{...box,height:15},{...box,left:.2},{...box,width:999},{...box,top:NaN}])("rejects invalid/out-of-page crop %j before classification",async value=>{expect(()=>validateCrop(value,600,800)).toThrow();await expect(saveManualImageCrop("review",value,"admin")).rejects.toThrow();expect(h.classify).not.toHaveBeenCalled();expect(h.update).not.toHaveBeenCalled();});
it("refuses cropping unsafe source pages even if the selected rectangle looks safe",async()=>{
 h.assets.get(sourceId)!.approval!.contains_personal_info=true;await expect(saveManualImageCrop("review",box,"admin")).rejects.toThrow("privacy");expect(h.classify).not.toHaveBeenCalled();expect(h.save).not.toHaveBeenCalled();
});
it("withholds a crop containing personal information or an unavailable privacy check without replacing the old preview",async()=>{
 const old=h.row.visual!.src;h.classify.mockImplementation(async(bytes:Buffer)=>({...h.assets.get(sourceId)!.approval!,pageHash:createHash("sha256").update(bytes).digest("hex"),contains_personal_info:true}));await expect(saveManualImageCrop("review",box,"admin")).rejects.toThrow("personal-information");expect(h.row.visual!.src).toBe(old);expect(h.save).not.toHaveBeenCalled();expect(h.update).not.toHaveBeenCalled();
 h.classify.mockRejectedValueOnce(Error("budget unavailable"));await expect(saveManualImageCrop("review",undefined,"admin",true)).rejects.toThrow();expect(h.update).not.toHaveBeenCalled();
});
it("blocks residential cases, generated maps, changed source hashes and unauthenticated actors",async()=>{
 h.residential.mockReturnValue(true);await expect(cropSource("review")).rejects.toThrow("residential");h.residential.mockReturnValue(false);
 await expect(saveManualImageCrop("review",box,"someone")).rejects.toThrow("admin");await expect(saveManualImageCrop("review",box,"admin",false,"b".repeat(64))).rejects.toThrow("changed");h.row.visual!.approval!.generated="gis-boundary-v1";await expect(cropSource("review")).rejects.toThrow("approved");expect(h.classify).not.toHaveBeenCalled();
});
it("fails closed outside production and refuses stale review writes",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");await expect(saveManualImageCrop("review",box,"admin")).rejects.toThrow("disabled");expect(h.classify).not.toHaveBeenCalled();
 vi.stubEnv("VERCEL_ENV","production");h.update.mockRejectedValueOnce(Error("Image changed"));await expect(saveManualImageCrop("review",box,"admin")).rejects.toThrow("changed");expect(h.row.visual!.src).toContain(sourceId);
});
