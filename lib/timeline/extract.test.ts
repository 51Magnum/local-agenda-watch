vi.mock("../ai-budget",async original=>({...await original<typeof import("../ai-budget")>(),aiBudget:{reserve:vi.fn().mockResolvedValue("reservation"),settle:vi.fn().mockResolvedValue(.0001)},reserveCost:()=>.01}));
vi.mock("unpdf",()=>({definePDFJSModule:vi.fn(),getDocumentProxy:vi.fn().mockResolvedValue({numPages:20,loadingTask:{destroy:vi.fn()}}),renderPageAsImage:vi.fn().mockResolvedValue(new Uint8Array([1,2,3]).buffer)}));
import { afterEach, expect, it, vi } from "vitest";
import { ocrMissingPages } from "./extract";
import {inputTokenBound} from "../ai-budget";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function apiResult(text:unknown) { return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ text }) }] }] }); }
it("transcribes only missing pages and retains physical PDF page numbers", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const fetcher = vi.fn().mockResolvedValue(apiResult("Text transcribed from the scanned decision letter."));
  vi.stubGlobal("fetch", fetcher);
  const pages = await ocrMissingPages(new TextEncoder().encode("%PDF-fixture"), [{ page: 1, text: "Existing native page text with enough content for extraction.", method: "native" }, { page: 2, text: "", method: "native" }]);
  expect(pages[0].method).toBe("native");
  expect(pages[1]).toMatchObject({ page: 2, method: "ocr" });
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.input[0].content[1].type).toBe("input_image");
  expect(body.input[0].content[1].image_url).toMatch(/^data:image\/png;base64,/);
  expect(JSON.stringify(body)).not.toContain("file_data");
  await ocrMissingPages(new TextEncoder().encode("%PDF-fixture"), pages);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects an invalid bounded OCR response rather than inventing page text", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(apiResult(null)));
  await expect(ocrMissingPages(new Uint8Array([1]), [{ page: 2, text: "", method: "native" }])).rejects.toThrow("Invalid bounded OCR");
});
it("bounds a 20-page scanned PDF to two physical page images that fit the 60k cap",async()=>{
 vi.stubEnv("OPENAI_API_KEY","test-key");const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(apiResult("Official scanned report text.")));vi.stubGlobal("fetch",fetcher);
 const pages=await ocrMissingPages(new TextEncoder().encode("%PDF-fixture"),Array.from({length:20},(_,i)=>({page:i+1,text:"",method:"native" as const})));
 expect(pages.filter(p=>p.method==="ocr").map(p=>p.page)).toEqual([1,2]);expect(pages.filter(p=>p.method==="native")).toHaveLength(18);expect(fetcher).toHaveBeenCalledTimes(2);
 for(const call of fetcher.mock.calls){const body=JSON.parse(call[1].body);expect(inputTokenBound(body.input[0].content,body.instructions,body.text.format.schema)+body.max_output_tokens).toBeLessThan(60000);expect(JSON.stringify(body)).not.toContain("file_data");}
});
