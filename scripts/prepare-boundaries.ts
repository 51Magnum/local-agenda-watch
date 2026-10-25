import { AREAS } from "../lib/areas/registry";
import {
  simplify,
  feature,
  truncate,
  difference,
  featureCollection,
} from "@turf/turf";
import { mkdir, writeFile } from "node:fs/promises";
const areas = Object.values(AREAS),
  shapes = areas.map((a) => ({
    ...truncate(simplify(feature(a.boundary), { tolerance: 0.0006 }), {
      precision: 6,
    }),
    properties: { id: a.id, name: a.name },
  }));
const world = feature({
  type: "Polygon" as const,
  coordinates: [
    [
      [-180, -85],
      [180, -85],
      [180, 85],
      [-180, 85],
      [-180, -85],
    ],
  ],
});
let uncovered = featureCollection([]);
try {
  const shape = difference(
    featureCollection([
      world,
      ...areas
        .filter((a) => a.status === "live")
        .map((a) =>
          simplify(feature(a.coverageBoundary ?? a.boundary), {
            tolerance: 0.0006,
          }),
        ),
    ]),
  );
  if (shape)
    uncovered = featureCollection([
      truncate(shape, { precision: 6 }),
    ]) as typeof uncovered;
} catch {
  /* Leave unshaded if invalid. */
}
async function write() {
  await mkdir("public/map-data", { recursive: true });
  await writeFile(
    "public/map-data/boundaries.json",
    JSON.stringify({
      uncovered,
      polygons: featureCollection(shapes),
      labels: featureCollection(
        areas.map((a) =>
          feature({ type: "Point", coordinates: a.center }, { name: a.name }),
        ),
      ),
    }),
  );
}
void write().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
