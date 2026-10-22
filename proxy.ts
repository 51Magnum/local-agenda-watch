import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Known locality subdomains. Requests to <locality>.localagendawatch.com are
// rewritten internally to /<locality>/<rest> so the subdomain stays in the
// URL bar. Requests that explicitly include the /<locality> prefix on the
// subdomain are redirected to the clean form first.
const LOCALITIES = new Set(["nampa"]);

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const parts = host.split(".");
  if (parts.length < 3) return;

  const [subdomain, ...rest] = parts;
  if (rest.join(".") !== "localagendawatch.com") return;
  if (!LOCALITIES.has(subdomain)) return;

  const { pathname } = request.nextUrl;
  if (["/robots.txt", "/sitemap.xml", "/about", "/contact", "/privacy"].includes(pathname)) return;
  const prefix = `/${subdomain}`;

  // Normalise `nampa.localagendawatch.com/nampa[/...]` to the clean subdomain
  // URL with a permanent redirect, so shared links stay canonical.
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    const cleaned = request.nextUrl.clone();
    const stripped = pathname.slice(prefix.length);
    cleaned.pathname = stripped === "" ? "/" : stripped;
    return NextResponse.redirect(cleaned, 308);
  }

  // Rewrite the subdomain path to the internal /<locality>-prefixed route.
  const rewritten = request.nextUrl.clone();
  rewritten.pathname = pathname === "/" ? prefix : `${prefix}${pathname}`;
  return NextResponse.rewrite(rewritten);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
