import { AREAS, areaPath } from "@/lib/areas/registry";
import { authorizedReviewer } from "@/lib/timeline/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Preserve legacy locality links while making country/state/area paths canonical.
function routeProxy(request: NextRequest) {
  if(request.nextUrl.pathname === "/_next/image") {
    const source=request.nextUrl.searchParams.get("url")??"";
    if(/\/api\/maps\/.+\/visual\/|\/(?:nampa|us\/id\/nampa)\/.+\.(?:png|jpe?g|webp)/i.test(source)) return new NextResponse("Image removed pending privacy verification",{status:410,headers:{"Cache-Control":"private, no-store, max-age=0"}});
    return;
  }
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    if (!process.env.REVIEW_ADMIN_PASSWORD) return new NextResponse("Review access is not configured", { status: 503, headers: { "Cache-Control": "no-store" } });
    if (!authorizedReviewer(request.headers.get("authorization"))) return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Case evidence review", charset="UTF-8"', "Cache-Control": "no-store" } });
    return NextResponse.next({ headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  }
  const path=request.nextUrl.pathname;
  if(["/nampa/toll-brothers-amity-happy-valley","/us/id/nampa/toll-brothers-amity-happy-valley"].includes(path)){const target=request.nextUrl.clone();target.pathname="/us/id/nampa/braeburn-creek";return NextResponse.redirect(target,308);}
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
export function proxy(request:NextRequest){const response=routeProxy(request);if(process.env.VERCEL_ENV==="production")return response;const result=response??NextResponse.next();result.headers.set("X-Robots-Tag","noindex, nofollow");return result;}
export const config={matcher:["/((?!_next/static|favicon.ico).*)"]};
