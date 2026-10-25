import { cachedViewport } from "@/lib/maps/case-index";
import { parseMapBounds } from "@/lib/maps/radius";
import { snapBounds, zoomTier } from "@/lib/maps/viewport";
import { withDbTransfer, currentDbTransfer } from "@/lib/db-transfer";
import { packViewport } from "@/lib/maps/viewport-wire";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request) {
  const url = new URL(request.url),
    raw = parseMapBounds(url.searchParams.get("bbox")),
    z = Number(url.searchParams.get("zoom"));
  if (
    !raw ||
    !url.searchParams.has("zoom") ||
    !Number.isFinite(z) ||
    z < 0 ||
    z > 24
  )
    return Response.json(
      { error: "Provide valid bbox and zoom." },
      { status: 400 },
    );
  const zoom = zoomTier(z),
    bounds =
      zoom < 9
        ? ([-180, -85, 180, 85] as [number, number, number, number])
        : snapBounds(raw, zoom),
    canonical = bounds.join(",");
  if (
    url.searchParams.get("bbox") !== canonical ||
    url.searchParams.get("zoom") !== String(zoom)
  ) {
    url.searchParams.set("bbox", canonical);
    url.searchParams.set("zoom", String(zoom));
    return Response.redirect(url, 307);
  }
  return withDbTransfer(async () => {
    const data = await cachedViewport(bounds, zoom),
      metrics = currentDbTransfer();
    console.info(
      "[map:viewport]",
      JSON.stringify({
        zoom,
        features: data.cases.length,
        bytes: Buffer.byteLength(JSON.stringify(data)),
        queries: metrics?.readQueries ?? 0,
        readBytes: metrics?.readBytes ?? 0,
      }),
    );
    return Response.json(url.searchParams.get("compact") === "1" ? packViewport(data) : data, {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
        "X-LAW-Origin-Queries": String(metrics?.readQueries ?? 0),
      },
    });
  });
}
