import {liveAreaAtPoint,locationMapUrl} from "@/lib/areas/coverage";
import { isLonLat } from "@/lib/maps/types";
import { AREAS } from "@/lib/areas/registry";
import { circle, booleanIntersects, feature } from "@turf/turf";
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
      {
        area: (()=>{const a=liveAreaAtPoint(d.coordinates);return a?{id:a.id}:undefined;})(),
        mapUrl:locationMapUrl(d.coordinates,undefined,d.radius),
        areas: Object.values(AREAS)
          .filter(
            (a) =>
              a.status === "live" &&
              booleanIntersects(
                circle(d.coordinates, d.radius, { units: "miles" }),
                feature(a.coverageBoundary ?? a.boundary),
              ),
          )
          .map((a) => a.name),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Invalid location" }, { status: 400 });
  }
}
