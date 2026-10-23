import { getJurisdiction } from "@/lib/maps/jurisdictions";
import { readMapSnapshot } from "@/lib/maps/store";
import { publicMapData, refreshJurisdiction } from "@/lib/maps/refresh";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request, { params }: { params: Promise<{ jurisdiction: string }> }) {
  const config = getJurisdiction((await params).jurisdiction);
  if (!config) return Response.json({ error: "Jurisdiction not configured" }, { status: 404 });
  try {
    const snapshot = await readMapSnapshot(config.id) ?? await refreshJurisdiction(config);
    const flum = new URL(request.url).searchParams.get("layer") === "flum";
    if (flum && !snapshot.flum) return Response.json({ error: "Future land use temporarily unavailable" }, { status: 503 });
    return Response.json(flum ? snapshot.flum : publicMapData(config, snapshot), { headers: { "Cache-Control": flum ? "public, max-age=3600, s-maxage=3600" : "public, max-age=300, s-maxage=300" } });
  } catch { return Response.json({ error: "Map data temporarily unavailable. The case list and official GIS sources remain available." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
