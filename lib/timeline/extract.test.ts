import { afterEach, expect, it, vi } from "vitest";
import { ocrMissingPages } from "./extract";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function apiResult(pages: { page: number; text: string }[]) { return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ pages }) }] }] }); }
it("transcribes only missing pages and retains physical PDF page numbers", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const fetcher = vi.fn().mockResolvedValue(apiResult([{ page: 2, text: "Text transcribed from the scanned decision letter." }]));
  vi.stubGlobal("fetch", fetcher);
  const pages = await ocrMissingPages(new TextEncoder().encode("%PDF-fixture"), [{ page: 1, text: "Existing native page text with enough content for extraction.", method: "native" }, { page: 2, text: "", method: "native" }]);
  expect(pages[0].method).toBe("native");
  expect(pages[1]).toMatchObject({ page: 2, method: "ocr" });
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.input[0].content[1].type).toBe("input_file");
  expect(body.input[0].content[1].file_data).toMatch(/^data:application\/pdf;base64,/);
  await ocrMissingPages(new TextEncoder().encode("%PDF-fixture"), pages);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects missing OCR pages rather than assigning text to the wrong page", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(apiResult([{ page: 1, text: "Wrong page" }])));
  await expect(ocrMissingPages(new Uint8Array([1]), [{ page: 2, text: "", method: "native" }])).rejects.toThrow("OCR missing page 2");
});
