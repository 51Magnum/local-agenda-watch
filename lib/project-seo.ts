import type { Metadata } from "next";
import type { PaneData } from "./maps/project-questions";
import { projectDetail } from "./maps/project-detail";
import { getProjectForCase } from "./projects";
import { AREAS, areaPath } from "./areas/registry";
import { SITE_ORIGIN } from "./site-config";
export function projectCanonical(data: PaneData) {
  const project = getProjectForCase(
    data.item.id.split(":").at(-1)!,
    data.area.id,
  );
  return (
    SITE_ORIGIN +
    (project
      ? areaPath(data.area.id) + "/" + project.slug
      : data.item.href || areaPath(data.area.id) + "/plan/" + data.item.id)
  );
}
export function projectMetadata(data: PaneData): Metadata {
  const title =
    (data.item.popup?.headline ?? data.item.title) +
    " · " +
    data.area.name +
    " | Local Agenda Watch";
  const description =
    data.item.popup?.explanation ??
    `See what's proposed, what's happened, the next step, and official records for ${data.item.title} in ${data.area.name}.`;
  const url = projectCanonical(data),
    image =
      SITE_ORIGIN +
      "/api/og/project?" +
      new URLSearchParams({
        area: data.area.id,
        case: data.item.id.split(":").at(-1)!,
      });
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
export async function projectFromShare(value: unknown) {
  if (typeof value !== "string") return;
  const [area, id] = value.split(/[/:]/);
  if (!AREAS[area] || !id || !/^[A-Z0-9-]+$/i.test(id)) return;
  return await projectDetail(area, id.toUpperCase());
}
