import { expect, it } from "vitest";
import { geometryCentroid } from "./spatial";
it("centers multipart project boundaries without the convex-hull fallback", () => {
  const ring = (x: number) => [[x, 43], [x+0.01,43], [x+0.01,43.01], [x,43.01], [x,43]];
  const center = geometryCentroid({type:"MultiPolygon",coordinates:[[ring(-116.6)],[ring(-116.58)]]});
  expect(center[0]).toBeCloseTo(-116.585, 5);
  expect(center[1]).toBeCloseTo(43.005, 5);
});
