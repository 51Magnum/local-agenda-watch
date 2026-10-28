import {expect,it,vi} from "vitest";
vi.mock("unpdf",()=>({definePDFJSModule:vi.fn().mockResolvedValue(undefined),getDocumentProxy:vi.fn().mockResolvedValue({numPages:40,loadingTask:{destroy:vi.fn()}}),renderPageAsImage:vi.fn().mockResolvedValue(new Uint8Array([1,2,3]).buffer)}));
vi.mock("../timeline/extract",()=>({structuredResponse:vi.fn().mockResolvedValue({text:"Official case report words"})}));
import {ocrSamplePages} from "./pdf-sample";
import {structuredResponse} from "../timeline/extract";
import {renderPageAsImage} from "unpdf";
it("OCRs at most two physical page images and never submits the whole PDF",async()=>{
 const result=await ocrSamplePages(new Uint8Array([37,80,68,70]),[2,7,12],Date.now()+60000);
 expect(result.map(p=>p.page)).toEqual([2,7]);expect(renderPageAsImage).toHaveBeenCalledTimes(2);
 for(const call of vi.mocked(structuredResponse).mock.calls){const content=call[2] as {type:string;image_url?:string;file_data?:string}[];expect(content.some(c=>c.type==="input_image")).toBe(true);expect(content.some(c=>c.file_data||c.type==="input_file")).toBe(false);}
});
