import {beforeEach,expect,it,vi} from "vitest";
import {createHash} from "node:crypto";
import sharp from "sharp";
vi.mock("@/lib/maps/jurisdictions",()=>({getJurisdiction:()=>({id:"nampa"})}));
vi.mock("@/lib/maps/visual-store",()=>({readVisualAsset:vi.fn(),saveVisualAsset:vi.fn()}));
vi.mock("@/lib/maps/image-review-store",()=>({imageAssetIsActive:vi.fn()}));
import {readVisualAsset,saveVisualAsset} from "@/lib/maps/visual-store";
import {imageAssetIsActive} from "@/lib/maps/image-review-store";
import {GET} from "./route";
const params={params:Promise.resolve({jurisdiction:"nampa",asset:"a".repeat(64)})};
beforeEach(()=>vi.resetAllMocks());
it("a preview never bypasses the active catalog or full-page privacy hash",async()=>{
 vi.mocked(imageAssetIsActive).mockResolvedValue(false);expect((await GET(new Request('https://local.test/image?preview=main-v1'),params)).status).toBe(410);expect(readVisualAsset).not.toHaveBeenCalled();
 vi.mocked(imageAssetIsActive).mockResolvedValue(true);vi.mocked(readVisualAsset).mockResolvedValue({image:"bad",approval:{version:"privacy-allowlist-v1",pageHash:"b".repeat(64),type:"site plan",contains_personal_info:false,confidence:.9,checkedAt:""}});expect((await GET(new Request('https://local.test/image?preview=main-v1'),params)).status).toBe(410);expect(saveVisualAsset).not.toHaveBeenCalled();
});
it("caches a derived preview and keeps the full exhibit byte-for-byte unchanged",async()=>{
 const bytes=await sharp(Buffer.from('<svg width="500" height="700"><rect width="500" height="700" fill="white"/><rect x="40" y="60" width="420" height="250" fill="blue"/><rect x="40" y="400" width="420" height="250" fill="green"/></svg>')).webp().toBuffer();
 const asset={image:bytes.toString('base64'),approval:{version:"privacy-allowlist-v1",pageHash:createHash('sha256').update(bytes).digest('hex'),type:"vicinity/aerial exhibit",contains_personal_info:false,confidence:.95,checkedAt:""}};
 vi.mocked(imageAssetIsActive).mockResolvedValue(true);vi.mocked(readVisualAsset).mockResolvedValue(asset);
 const preview=await GET(new Request('https://local.test/image?preview=main-v1'),params);expect(preview.status).toBe(200);expect(saveVisualAsset).toHaveBeenCalledTimes(1);const saved=vi.mocked(saveVisualAsset).mock.calls[0][2];expect(saved.image).toBe(asset.image);expect(saved.preview?.crop.height).toBeLessThan(350);
 vi.mocked(readVisualAsset).mockResolvedValue(saved);await GET(new Request('https://local.test/image?preview=main-v1'),params);expect(saveVisualAsset).toHaveBeenCalledTimes(1);
 const full=await GET(new Request('https://local.test/image'),params);expect(Buffer.from(await full.arrayBuffer()).equals(bytes)).toBe(true);
});
