import type { MapCase } from "./types";
export type Bounds = [number, number, number, number];
export type MapSummary = {
  id: string;
  name: string;
  center: [number, number];
  count: number;
  upcoming: number;
  bounds: Bounds;
};
export type ViewportData = {
  cases: MapCase[];
  summaries: MapSummary[];
  truncated: boolean;
  updatedAt: string;
  bounds: Bounds;
};
export function zoomTier(zoom: number) {
  return zoom < 9 ? 8 : Math.min(18, Math.floor(zoom));
}
export function gridSize(zoom: number) {
  return 360 / 2 ** Math.max(0, zoomTier(zoom) - 2);
}
export function snapBounds(bounds: Bounds, zoom: number): Bounds {
  const s = gridSize(zoom),
    lo = (x: number) => Math.floor(x / s + 1e-6) * s,
    hi = (x: number) => Math.ceil(x / s - 1e-6) * s;
  return [
    Math.max(-180, lo(bounds[0])),
    Math.max(-85, lo(bounds[1])),
    Math.min(180, hi(bounds[2])),
    Math.min(85, hi(bounds[3])),
  ].map((n) => Number(n.toFixed(7))) as Bounds;
}
export function gridCells(bounds: Bounds, zoom: number): Bounds[] {
  if (zoom < 9) return [[-180, -85, 180, 85]];
  const s = gridSize(zoom),
    b = snapBounds(bounds, zoom),
    cells: Bounds[] = [];
  for (let x = b[0]; x < b[2] - 1e-8; x += s)
    for (let y = b[1]; y < b[3] - 1e-8; y += s) {
      cells.push(
        [x, y, Math.min(180, x + s), Math.min(85, y + s)].map((n) =>
          Number(n.toFixed(7)),
        ) as Bounds,
      );
      if (cells.length >= 24) return cells;
    }
  return cells;
}
export function bufferedBounds([w, s, e, n]: Bounds): Bounds {
  const x = (e - w) * 0.2,
    y = (n - s) * 0.2;
  return [
    Math.max(-180, w - x),
    Math.max(-85, s - y),
    Math.min(180, e + x),
    Math.min(85, n + y),
  ];
}
export function caseInFilter(
  c: MapCase,
  filter: string,
  today = new Date().toISOString().slice(0, 10),
) {
  if (filter === "hearings")
    return Boolean(c.nextHearing && c.nextHearing.date >= today);
  if (filter === "decided")
    return (
      c.stage === "Decided" &&
      Boolean(
        c.decisionDate &&
        c.decisionDate >=
          new Date(Date.parse(today) - 30 * 86400000)
            .toISOString()
            .slice(0, 10),
      )
    );
  if (filter === "homes")
    return /residen|homes|housing|subdiv|\bplat\b|lots|dwell/i.test(
      c.title + " " + c.typeLabel + " " + c.summary,
    );
  if (filter === "business")
    return /commercial|industrial|retail|warehouse|office|gas station|business|concrete/i.test(
      c.title + " " + c.summary + " " + c.typeLabel,
    );
  return true;
}

export type MapAreaInfo = {
  id: string;
  name: string;
  stateAbbreviation: string;
  href: string;
  center: [number, number];
  bounds: Bounds;
  status: string;
};
export const commonStageLabel = (stage: string) =>
  stage === "P&Z" ? "Hearing" : stage;
