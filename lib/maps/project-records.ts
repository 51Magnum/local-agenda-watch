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
    urls = urls.map((url) => residentPaneHref(area, url));
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
      specific ?? residentPaneHref(area, area.residentAccess?.archiveUrl);
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
