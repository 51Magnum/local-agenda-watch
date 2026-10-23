import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadDocument } from "@/lib/timeline/ingest";
import { createEnerGovClient } from "./energov";
import { energovDocumentReference } from "./energov-document";
import { evidenceSourceHref } from "@/lib/timeline/types";
const plan = "885c7660-323f-4486-9d09-75d47c42968f", attachment = "11111111-2222-3333-4444-555555555555";
const portal = "https://nampaid-energovpub.tylerhost.net/Apps/SelfService#/plan/" + plan;
const pdf = new TextEncoder().encode("%PDF-1.7\nPublic decision letter fixture");
afterEach(() => vi.unstubAllGlobals());
const files = (over = {}) => Response.json({ Success: true, Result: { Attachments: [{ AttachmentID: attachment, FileName: "Braeburn Creek_Decision Letter PZ.pdf", IsFileSecure: false, IsOnline: false, ...over }] } });
const metadata = () => Response.json({ Success: true, Result: { FileName: "decision.pdf", FileSize: pdf.length, FileToken: "temporary-file-token" } });
describe("verified EnerGov public downloads", () => {
  it("uses FileID headers for metadata and token/range headers for the PDF, including files uploaded internally", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(files()).mockResolvedValueOnce(metadata()).mockResolvedValueOnce(new Response(pdf, { status: 206, headers: { "Content-Range": "bytes 0-" + (pdf.length - 1) + "/" + pdf.length } }));
    vi.stubGlobal("fetch", fetcher);
    const source = energovDocumentReference(portal, attachment);
    expect(await downloadDocument(source)).toEqual(pdf);
    expect(fetcher.mock.calls[1][0]).toBe("https://nampaid-energovpub.tylerhost.net/apps/selfservice/api/energov/attachments/metadata/");
    expect(fetcher.mock.calls[1][1].headers).toMatchObject({ FileID: attachment, DownloadProvider: "attachment", FileType: "attachment", FileToken: "" });
    expect(fetcher.mock.calls[2][1]).toMatchObject({ redirect: "error", headers: { FileID: attachment, FileToken: "temporary-file-token", range: "bytes=0-" + (pdf.length - 1) } });
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes("temporary-file-token"))).toBe(true);
    expect(evidenceSourceHref({ sourceUrl: source, page: 2 })).toBe(source);
  });
  it.each([{ IsFileSecure: true }, { FileName: "Neighborhood Meeting Sign In Sheet.pdf" }, { AttachmentID: "different-file" }])("refuses non-public or unrelated files before requesting a token (%j)", async (over) => {
    const fetcher = vi.fn().mockResolvedValue(files(over)); vi.stubGlobal("fetch", fetcher);
    await expect(downloadDocument(energovDocumentReference(portal, attachment))).rejects.toThrow("not a public case PDF");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects incomplete ranges and mismatched PDF sizes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(new Response(pdf, { status: 206, headers: { "Content-Range": "bytes 0-999/1000" } })));
    await expect(createEnerGovClient({ baseUrl: "https://nampaid-energovpub.tylerhost.net", tenantId: 1, tenantName: "NampaIDProd" }).downloadAttachment!(attachment)).rejects.toThrow("range mismatch");
  });
});
