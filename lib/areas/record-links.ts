/** Public links must open readable pages, never GIS API responses. */
export function residentHref(value?: string | null): string | undefined {
  if (!value || /\/rest\/services\/|\/query(?:[?#]|$)|[?&]f=(?:pjson|json)(?:[&#]|$)/i.test(value)) return;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const url = new URL(value); if (url.protocol === "https:" || url.protocol === "http:") return value; } catch { /* Missing or invalid provenance is not a public link. */ }
}
export type RecordPageContext = { urls: (string | null | undefined)[]; baseRecordUrl?: string };
export function recordPageOnHosts(context: RecordPageContext, hosts: string[]): string | undefined {
  return context.urls.map(residentHref).find(url => url && hosts.includes(new URL(url,"https://local.invalid").hostname.toLowerCase())) ?? residentHref(context.baseRecordUrl);
}
