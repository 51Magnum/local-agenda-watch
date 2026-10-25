import type { AreaDefinition } from "@/lib/areas/registry";
import { residentHref } from "@/lib/areas/record-links";
import type { Hearing } from "@/lib/localities/types";
import type { PublicCaseRecord } from "@/lib/localities/record-types";

/** Link to known human-readable project records, never manufacture a GIS database link. */
export function officialProjectRecords(
  area: AreaDefinition,
  hearings: Hearing[],
  record?: PublicCaseRecord,
) {
  const links = new Map<string, { label: string; url: string }>();
  const readable = (urls: (string | null | undefined)[]) =>
    area.recordPage
      ? area.recordPage({ urls })
      : urls.map(residentHref).find(Boolean);
  for (const hearing of hearings) {
    const direct = readable([hearing.externalUrl, record?.sourceUrl]);
    const url =
      direct ??
      readable([
        ...(record?.events ?? []).map((e) => e.sourceUrl),
        ...hearing.meetings.flatMap((m) => [m.agendaUrl, m.sourceUrl]),
      ]);
    if (!url || !residentHref(url)) continue;
    const existing = links.get(url);
    links.set(url, {
      url,
      label: existing
        ? existing.label + " · " + hearing.appId
        : area.name +
          (direct ? " project record" : " hearing record") +
          " · " +
          hearing.appId,
    });
  }
  return [...links.values()];
}
