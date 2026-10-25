import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-config";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/", "/api/og/"], disallow: ["/admin/", "/api/"] }, sitemap: SITE_ORIGIN + "/sitemap.xml" };
}
