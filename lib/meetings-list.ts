import { unstable_cache } from "next/cache";
import { getLocality } from "./localities";
import { caseCatalog } from "./case-catalog";
import { AREAS } from "./areas/registry";
import { residentPaneHref } from "./maps/project-records";
import { denverInstant } from "./case-details";
import { getNampaMeetingArchive } from "./sources/primegov";
export type MeetingRow = {
  id: string;
  date: string;
  startsAt: string;
  body: string;
  title: string;
  caseIds: string[];
  links: { label: string; url: string }[];
};
export async function meetingsList(areaId: string, year: number) {
  return unstable_cache(
    async () => {
      const area = AREAS[areaId],
        feed = await getLocality(areaId)?.getHearings?.(),
        rows: MeetingRow[] = [];
      if (!feed) return { rows, updatedAt: null, unavailable: true };
      for (const h of caseCatalog(feed))
        for (const m of h.meetings) {
          if (!m.date.startsWith(String(year))) continue;
          const id = m.body + ":" + m.date,
            prior = rows.find((r) => r.id === id),
            links = [
              { label: "Official notice", url: m.sourceUrl },
              { label: "Agenda", url: m.agendaUrl },
              { label: "Packet", url: m.packetUrl },
            ].flatMap((l) => {
              const url = residentPaneHref(area, l.url);
              return url ? [{ ...l, url }] : [];
            });
          if (prior) {
            prior.caseIds.push(h.appId);
            prior.links = [
              ...new Map(
                [...prior.links, ...links].map((l) => [l.url, l]),
              ).values(),
            ];
          } else
            rows.push({
              id,
              date: m.date,
              startsAt: m.time
                ? denverInstant(m.date, m.time, area.timezone)
                : m.date,
              body: m.bodyLabel ?? m.body,
              title: m.bodyLabel ?? m.body,
              caseIds: [h.appId],
              links,
            });
        }
      const archive =
        areaId === "nampa"
          ? await getNampaMeetingArchive(year)
          : { meetings: feed.agendaMeetings ?? [], unavailable: false };
      for (const m of archive.meetings) {
        if (!m.date.startsWith(String(year))) continue;
        const id = m.body + ":" + m.date,
          prior = rows.find((r) => r.id === id);
        const links = [
          { label: "Agenda", url: m.agendaUrl },
          { label: "Minutes", url: m.minutesUrl },
          { label: "Packet", url: m.packetUrl },
          { label: "Official meeting record", url: m.sourceUrl },
        ].flatMap((l) => {
          const url = residentPaneHref(area, l.url);
          return url ? [{ ...l, url }] : [];
        });
        if (prior) {
          prior.caseIds = [
            ...new Set([
              ...prior.caseIds,
              ...m.items.flatMap((i) => i.caseIds),
            ]),
          ];
          prior.links = [
            ...new Map(
              [...prior.links, ...links].map((l) => [l.url, l]),
            ).values(),
          ];
        } else
          rows.push({
            id,
            date: m.date,
            startsAt: m.localStartTime
              ? denverInstant(m.date, m.localStartTime, area.timezone)
              : m.date,
            body: m.bodyLabel,
            title: m.title,
            caseIds: [...new Set(m.items.flatMap((i) => i.caseIds))],
            links,
          });
      }
      return {
        rows: rows.sort((a, b) => b.date.localeCompare(a.date)),
        updatedAt: feed.refreshedAt ?? null,
        unavailable: !!feed.dataUnavailable || archive.unavailable,
      };
    },
    ["resident-meetings-v1", areaId, String(year)],
    { revalidate: 86400, tags: ["map-area:" + areaId, areaId + ":archive"] },
  )();
}
