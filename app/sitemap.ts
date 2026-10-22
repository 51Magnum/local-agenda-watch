import type { MetadataRoute } from "next";
import { listLocalities } from "@/lib/localities";
import { projects } from "@/lib/projects";
import { SITE_ORIGIN } from "@/lib/site-config";
export const revalidate = 1800;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls = new Set(["/", "/nampa", "/nampa/meetings", "/about", "/contact", "/privacy", ...projects.map((p) => "/nampa/" + p.slug)]);
  for (const locality of listLocalities()) {
    const feed = await locality.getHearings?.();
    for (const h of [...(feed?.active ?? []), ...(feed?.completed ?? []), ...(feed?.upcomingOnly ?? [])]) {
      urls.add("/" + locality.slug + "/plan/" + encodeURIComponent(h.appId));
    }
    for (const p of projects) for (const id of p.caseIds) urls.add("/nampa/plan/" + id);
  }
  return [...urls].map((path) => ({ url: SITE_ORIGIN + path }));
}
