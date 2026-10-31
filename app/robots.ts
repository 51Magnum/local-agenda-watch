import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site-config";
export default function robots(): MetadataRoute.Robots {
  if(process.env.VERCEL_ENV!=="production")return {rules:{userAgent:"*",disallow:"/"}};
  return { rules: { userAgent: "*", allow: ["/", "/api/og/"], disallow: ["/admin/", "/api/"] }, sitemap: SITE_ORIGIN + "/sitemap.xml" };
}
