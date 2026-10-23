import { createEnerGovClient } from "./energov";
import { isPrivateDocument } from "@/lib/case-details";
const ORIGIN = "https://nampaid-energovpub.tylerhost.net";
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The attachmentId parameter identifies this source in our cache. The official
 * portal opens its document list; it does not promise a direct PDF deep link. */
export function energovDocumentReference(portalUrl: string, attachmentId: string): string {
  if (!GUID.test(attachmentId)) throw new Error("Invalid attachment ID");
  const url = new URL(portalUrl);
  if (url.origin !== ORIGIN || !/^#\/plan\/[0-9a-f-]{36}(?:\?|$)/i.test(url.hash)) throw new Error("Invalid official case source");
  const [path, query] = url.hash.split("?");
  const params = new URLSearchParams(query); params.set("tab", "attachments"); params.set("attachmentId", attachmentId);
  url.hash = path + "?" + params;
  return url.href;
}
export function parseEnerGovDocumentReference(value: string) {
  const url = new URL(value);
  if (url.origin !== ORIGIN || !/^\/apps\/selfservice\/?$/i.test(url.pathname)) return undefined;
  const [path, query] = url.hash.split("?");
  const planId = path.replace(/^#\/plan\//i, ""), attachmentId = new URLSearchParams(query).get("attachmentId");
  return GUID.test(planId) && attachmentId && GUID.test(attachmentId) ? { planId, attachmentId } : undefined;
}
export async function downloadEnerGovReference(reference: { planId: string; attachmentId: string }): Promise<Uint8Array> {
  const client = createEnerGovClient({ baseUrl: ORIGIN, tenantId: 1, tenantName: "NampaIDProd" });
  // Recheck ownership and public visibility; never mirror secure or resident attendance files.
  const files = await client.getPlanAttachments(reference.planId, { revalidate: 0 });
  const file = files.find((a) => a.AttachmentID.toLowerCase() === reference.attachmentId.toLowerCase());
  if (!file || file.IsFileSecure || isPrivateDocument(file.FileName + " " + (file.Notes ?? "")) || !/\.pdf$/i.test(file.FileName)) throw new Error("Document is not a public case PDF");
  return client.downloadAttachment!(reference.attachmentId);
}
