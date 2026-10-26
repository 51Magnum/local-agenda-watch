import type { CaseGeometry } from "./types";
import { mercator } from "./fallback-image";
/** Actual public geometry only; residential geometry has already been broadened by the shared loader. */
export function outlineThumbnail(geometry: CaseGeometry | null) {
  if (!geometry) return;
  const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates,
    points = polygons.flat(2).map(mercator),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    w = Math.max(...xs) - Math.min(...xs) || 1,
    h = Math.max(...ys) - Math.min(...ys) || 1,
    scale = Math.min(330 / w, 510 / h),
    ox = (420 - w * scale) / 2,
    oy = (630 - h * scale) / 2,
    minX = Math.min(...xs),
    maxY = Math.max(...ys);
  const path = polygons
    .map((p) =>
      p
        .map(
          (r) =>
            r
              .map((xy, i) => {
                const [x, y] = mercator(xy);
                return (
                  (i ? "L" : "M") +
                  (ox + (x - minX) * scale).toFixed(2) +
                  "," +
                  (oy + (maxY - y) * scale).toFixed(2)
                );
              })
              .join(" ") + "Z",
        )
        .join(" "),
    )
    .join(" ");
  return (
    "data:image/svg+xml;base64," +
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="630"><rect width="420" height="630" fill="#e2e8f0"/><path d="${path}" fill="#99f6e4" stroke="#0f766e" stroke-width="4" fill-rule="evenodd"/></svg>`,
    ).toString("base64")
  );
}
