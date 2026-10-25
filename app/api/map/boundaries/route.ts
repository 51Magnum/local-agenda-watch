import { AREAS } from "@/lib/areas/registry";
import { bbox, simplify, feature } from "@turf/turf";
import { parseMapBounds } from "@/lib/maps/radius";
export async function GET(request: Request) {
  const b = parseMapBounds(new URL(request.url).searchParams.get("bbox"));
  if (!b) return Response.json({ error: "Invalid bounds" }, { status: 400 });
  const areas = Object.values(AREAS).filter((a) => {
    const x = bbox(a.boundary);
    return x[0] <= b[2] && x[2] >= b[0] && x[1] <= b[3] && x[3] >= b[1];
  });
  return Response.json(
    {
      polygons: {
        type: "FeatureCollection",
        features: areas.map((a) => ({
          ...simplify(feature(a.boundary), { tolerance: 0.0003 }),
          properties: { id: a.id, name: a.name },
        })),
      },
      labels: {
        type: "FeatureCollection",
        features: areas.map((a) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: a.center },
          properties: { name: a.name },
        })),
      },
    },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
