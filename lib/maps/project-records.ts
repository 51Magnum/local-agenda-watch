import type { AreaDefinition } from "@/lib/areas/registry";
import { residentHref } from "@/lib/areas/record-links";
import type { Hearing } from "@/lib/localities/types";
import type { PublicCaseRecord } from "@/lib/localities/record-types";

/** Verified access restrictions affect resident links only, never collection provenance. */
export function residentPaneHref(area: AreaDefinition, value?: string | null) {
  const href = residentHref(value);
  if (!href) return;
  const host = new URL(href, "https://local.invalid").hostname.toLowerCase();
  return area.residentAccess?.excludedHosts.includes(host) ? undefined : href;
}

/** Link to known human-readable project records, never manufacture a GIS database link. */
export function officialProjectRecords(
  area: AreaDefinition,
  hearings: Hearing[],
  record?: PublicCaseRecord,
  supportingRecords: { caseIds: string[]; url: string }[] = [],
) {
  const links = new Map<string, { label: string; url: string }>();
  const readable = (urls: (string | null | undefined)[]) => {
    urls = urls.map((url) => residentPaneHref(area, url)).map(url=>url?caseSpecificRecordUrl(url,hearings.map(h=>h.appId)):undefined);
    return area.recordPage ? area.recordPage({ urls }) : urls.find(Boolean);
  };
  for (const hearing of hearings) {
    const direct = readable([hearing.externalUrl, record?.sourceUrl]);
    const specific =
      direct ??
      readable([
        ...(area.residentAccess?.caseRecords?.[hearing.appId] ?? []),
        ...supportingRecords
          .filter((r) => r.caseIds.includes(hearing.appId))
          .map((r) => r.url),
        ...(record?.events ?? []).map((e) => e.sourceUrl),
        ...hearing.meetings.flatMap((m) => [m.agendaUrl, m.sourceUrl]),
      ]);
    const url =
      specific;
    if (!url || !residentHref(url)) continue;
    const target = new URL(url, "https://local.invalid");
    const kind =
      direct && target.hostname === "experience.arcgis.com"
        ? " project map — search case"
        : direct && /\/public-hearing-notices\/?$/i.test(target.pathname)
          ? " hearing notices — search case"
          : direct && target.hostname === "meetings.municode.com"
            ? " hearing record"
            : direct
              ? " project record"
              : specific
                ? " hearing record"
                : " meeting archive — search case";
    const existing = links.get(url);
    links.set(url, {
      url,
      label: existing
        ? existing.label + " · " + hearing.appId
        : area.name + kind + " · " + hearing.appId,
    });
  }
  return [...links.values()];
}

/** A landing page cannot serve as a case record unless its URL identifies the case. */
export function caseSpecificRecordUrl(value:string,caseIds:string[]) {
  try {
    const url=new URL(value,"https://local.invalid");
    if(/\/rest\/services\/|\/query(?:[?#]|$)|[?&]f=(?:pjson|json)(?:[&#]|$)/i.test(value))return;
    if(caseIds.some(id=>decodeURIComponent(url.search+url.hash).toUpperCase().includes(id.toUpperCase())))return value;
    if(url.hostname==="experience.arcgis.com" || /\/public\/portal\/?$/i.test(url.pathname) || /\/(?:Upcoming-Public-Hearings|public-hearing-notices)\/?$/i.test(url.pathname))return;
    if(/^\/$|\/(?:Landing|calendar|agendas|portal)\/?$/i.test(url.pathname))return;
    return value;
  } catch { /* Invalid or generic URL is not a case record. */ }
}
