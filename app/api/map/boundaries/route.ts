import { AREAS } from "@/lib/areas/registry";
import {
  bbox,
  simplify,
  feature,
  difference,
  featureCollection,
  bboxClip,
  truncate,
} from "@turf/turf";
import { parseMapBounds, boundsPolygon } from "@/lib/maps/radius";
export async function GET(request: Request) {
  const b = parseMapBounds(new URL(request.url).searchParams.get("bbox"));
  if (!b) return Response.json({ error: "Invalid bounds" }, { status: 400 });
  const areas = Object.values(AREAS).filter((a) => {
    const x = bbox(a.boundary);
    return x[0] <= b[2] && x[2] >= b[0] && x[1] <= b[3] && x[3] >= b[1];
  });
  let uncovered: unknown = { type: "FeatureCollection", features: [] };
  try {
    const shape = difference(
      featureCollection([
        boundsPolygon(b),
        ...areas
          .filter((a) => a.status === "live")
          .map((a) =>
            simplify(feature(a.coverageBoundary ?? a.boundary), {
              tolerance: Math.max(0.0001, Math.min(0.01, (b[2] - b[0]) / 2500)),
            }),
          ),
      ]),
    );
    if (shape) uncovered = { type: "FeatureCollection", features: [truncate(bboxClip(shape, b), { precision: 5 })] };
  } catch {
    /* Malformed coverage geometry must not shade a tracked project. */
  }
  return Response.json(
    {
      uncovered,
      polygons: {
        type: "FeatureCollection",
        features: areas.map((a) => ({
          ...truncate(bboxClip(simplify(feature(a.boundary), { tolerance: 0.0003 }), b), { precision: 5 }),
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
