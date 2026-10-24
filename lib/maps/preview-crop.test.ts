import {expect,it} from "vitest";
import sharp from "sharp";
import {cropMainPanel} from "./preview-crop";
it("trims white margins and selects the first drawing from a two-panel exhibit",async()=>{
 const svg=Buffer.from('<svg width="800" height="1100"><rect width="800" height="1100" fill="white"/><text x="100" y="55">EXHIBITS</text><rect x="70" y="130" width="660" height="360" fill="#765b68"/><text x="90" y="550">SECOND MAP</text><rect x="70" y="600" width="660" height="400" fill="#0f766e"/></svg>');
 const result=await cropMainPanel(await sharp(svg).png().toBuffer());const m=await sharp(result.image).metadata();
 expect(result.crop.top).toBeGreaterThan(100);expect(result.crop.top+result.crop.height).toBeLessThan(550);expect(result.crop.left).toBeGreaterThan(50);expect(m.width!/m.height!).toBeGreaterThan(1.6);
 const pixel=await sharp(result.image).resize(1,1).raw().toBuffer();expect(pixel[0]).toBeGreaterThan(pixel[1]);
});
it("preserves line-only plans and blank images without manufacturing content",async()=>{
 for(const content of ['<path d="M100 100 H600 V600 H100Z M100 350 H600" stroke="black" stroke-width="3" fill="none"/>','']){
 const src=await sharp(Buffer.from('<svg width="700" height="700"><rect width="700" height="700" fill="white"/>'+content+'</svg>')).png().toBuffer();
 const result=await cropMainPanel(src);expect((await sharp(result.image).metadata()).width).toBeGreaterThan(0);
 }
});
