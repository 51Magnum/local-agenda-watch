import { isLonLat } from "@/lib/maps/types";
import { liveAreasInRadius } from "@/lib/maps/radius";
export async function POST(request: Request) {
  try {
    const d = await request.json();
    if (
      !Array.isArray(d.coordinates) ||
      !isLonLat(d.coordinates) ||
      !Number.isFinite(d.radius) ||
      d.radius <= 0 ||
      d.radius > 10
    )
      return Response.json({ error: "Invalid location" }, { status: 400 });
    return Response.json(
      { areas: liveAreasInRadius(d.coordinates, d.radius).map((a) => a.name) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Invalid location" }, { status: 400 });
  }
}
