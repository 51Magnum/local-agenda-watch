import { expect, it } from "vitest";
import {
  gridCells,
  snapBounds,
  bufferedBounds,
  caseInFilter,
  zoomTier,
} from "./viewport";
import type { MapCase } from "./types";
it("uses stable shared grid keys and reuses the same cells for small pans", () => {
  const a: [number, number, number, number] = [-116.52, 43.58, -116.5, 43.6],
    b: [number, number, number, number] = [-116.519, 43.581, -116.501, 43.599];
  expect(gridCells(a, 14)).toEqual(gridCells(b, 14));
  expect(snapBounds(snapBounds(a, 14), 14)).toEqual(snapBounds(a, 14));
  for (let zoom = 9; zoom <= 18; zoom++) {
    const snapped = snapBounds(a, zoom);
    expect(snapBounds(snapped, zoom)).toEqual(snapped);
  }
  expect(bufferedBounds([0, 0, 1, 1])).toEqual([-0.2, -0.2, 1.2, 1.2]);
});
it("uses one small overview below zoom 9 and discrete geometry tiers", () => {
  expect(gridCells([-118, 42, -111, 49], 7)).toEqual([[-180, -85, 180, 85]]);
  expect(zoomTier(13.9)).toBe(13);
  expect(zoomTier(14)).toBe(14);
});
it("keeps phone viewport requests local instead of downloading overlapping regional cells", () => {
  const cells = gridCells([-116.634, 43.418, -116.366, 43.782], 10);
  expect(cells.length).toBeLessThanOrEqual(6);
  for (const [w, s, e, n] of cells) {
    expect(e - w).toBeLessThan(.36);
    expect(n - s).toBeLessThan(.36);
  }
});
it("requires a real final-decision date for the last-30-days filter", () => {
  const c = {
    stage: "Decided",
    title: "Homes",
    summary: "",
    typeLabel: "Annexation",
  } as MapCase;
  expect(caseInFilter(c, "decided", "2026-10-25")).toBe(false);
  expect(
    caseInFilter({ ...c, decisionDate: "2026-10-19" }, "decided", "2026-10-25"),
  ).toBe(true);
  expect(
    caseInFilter({ ...c, decisionDate: "2026-09-01" }, "decided", "2026-10-25"),
  ).toBe(false);
});

it("does not label industrial plats as homes or future dates as past decisions", () => {
  const c = {
    stage: "Decided",
    title: "Industrial preliminary plat",
    typeLabel: "Preliminary plat",
    summary: "Warehouse construction",
    decisionDate: "2026-11-02",
  } as MapCase;
  expect(caseInFilter(c, "homes", "2026-10-25")).toBe(false);
  expect(caseInFilter(c, "business", "2026-10-25")).toBe(true);
  expect(caseInFilter(c, "decided", "2026-10-25")).toBe(false);
});
