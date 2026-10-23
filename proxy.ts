import { AREAS, areaPath } from "@/lib/areas/registry";
import { authorizedReviewer } from "@/lib/timeline/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Preserve legacy locality links while making country/state/area paths canonical.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    if (!process.env.REVIEW_ADMIN_PASSWORD) return new NextResponse("Review access is not configured", { status: 503, headers: { "Cache-Control": "no-store" } });
    if (!authorizedReviewer(request.headers.get("authorization"))) return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Case evidence review", charset="UTF-8"', "Cache-Control": "no-store" } });
    return NextResponse.next({ headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  }
  const path=request.nextUrl.pathname;
  if(path.startsWith("/api/")||path.startsWith("/maplibre/"))return;
  const host=(request.headers.get("host")??"").toLowerCase().split(":")[0];
  for(const area of Object.values(AREAS)){
    const old="/"+area.id,base=areaPath(area);
    if(path===old||path.startsWith(old+"/")){
      const target=request.nextUrl.clone();target.pathname=base+path.slice(old.length);return NextResponse.redirect(target,301);
    }
    if(host===area.id+".localagendawatch.com"){
      const target=request.nextUrl.clone();target.protocol="https:";target.host="www.localagendawatch.com";target.pathname=path.startsWith(base)?path:base+(path==="/"?"":path);return NextResponse.redirect(target,301);
    }
    // Keep existing image files available at their canonical area URLs.
    if(path.startsWith(base+"/")&&/\.(?:png|jpe?g|webp|svg)$/i.test(path)){
      const target=request.nextUrl.clone();target.pathname=old+path.slice(base.length);return NextResponse.rewrite(target);
    }
  }
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
