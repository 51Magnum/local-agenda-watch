import type { PaneData } from "./maps/project-questions";
import { SITE_ORIGIN } from "./site-config";
export function projectJsonLd(data: PaneData) {
  const url = SITE_ORIGIN + data.item.href,
    place = {
      "@type": "Place",
      name: data.where ?? data.area.name,
      address: data.where ?? data.area.name,
    };
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@id": url + "#place", ...place },
      ...(data.next
        ? [
            {
              "@type": "Event",
              name: data.item.title + " · " + data.next.body,
              startDate: data.next.startsAt,
              eventStatus: "https://schema.org/EventScheduled",
              location: {
                "@type": "Place",
                name: data.next.location ?? data.area.name,
                address: data.next.location ?? data.area.name,
              },
              organizer: {
                "@type": "GovernmentOrganization",
                name: data.next.body,
              },
              url: data.next.sourceUrl ?? url,
              description: data.item.popup?.explanation ?? data.item.title,
            },
          ]
        : []),
    ],
  };
}
