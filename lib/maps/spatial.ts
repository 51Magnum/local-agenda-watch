import { area, bbox, booleanIntersects, centerOfMass, feature, featureCollection, intersect, point, pointToPolygonDistance } from "@turf/turf";
import type { FeatureCollection } from "geojson";
import type { CaseGeometry, MapCase } from "./types";
export function geometryCentroid(geometry: CaseGeometry): [number, number] { return centerOfMass(feature(geometry)).geometry.coordinates.slice(0, 2) as [number, number]; }
export function flumAtGeometry(geometry: CaseGeometry, flum: FeatureCollection<CaseGeometry>, categoryField: string): string[] {
  const shape = feature(geometry), box = bbox(shape);
  const coverage = new Map<string, number>();
  const minimumArea = Math.max(1, area(shape) * 0.01);
  for (const candidate of flum.features) {
    const b = bbox(candidate);
    if (b[2] < box[0] || b[0] > box[2] || b[3] < box[1] || b[1] > box[3]) continue;
    try {
      if (!booleanIntersects(shape, candidate)) continue;
      const overlap = intersect(featureCollection([shape, candidate]));
      const category = candidate.properties?.[categoryField];
      if (overlap && typeof category === "string") coverage.set(category, (coverage.get(category) ?? 0) + area(overlap));
    } catch { /* Invalid upstream rings do not establish a category. */ }
  }
  // Ignore boundary slivers introduced by the different source alignments and simplification.
  return [...coverage].filter(([, squareMeters]) => squareMeters >= minimumArea).sort((a, b) => b[1] - a[1]).map(([category]) => category);
}
export function nearbyCases(cases: MapCase[], coordinates: [number, number], miles = 1) {
  return cases.filter((c) => c.geometry && !c.citywide).map((c) => ({ ...c, distance: Math.max(0, pointToPolygonDistance(point(coordinates), c.geometry!, { units: "miles" })) })).filter((c) => c.distance <= miles).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}
