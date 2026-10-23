export type ScreenPoint = { x: number; y: number };
type ScreenRect = { left: number; right: number; top: number; bottom: number };

// A narrow pointer corridor lets someone cross the gap to a fixed popup.
// Leaving this corridor or moving away closes it without a hover timeout.
export function movingToPopup(origin: ScreenPoint, previous: ScreenPoint, current: ScreenPoint, rect: ScreenRect): boolean {
  const distance = (p: ScreenPoint) => Math.hypot(Math.max(rect.left - p.x, 0, p.x - rect.right), Math.max(rect.top - p.y, 0, p.y - rect.bottom));
  if (distance(current) > distance(previous) + 1) return false;
  const padding = 8;
  const points = [
    { x: origin.x - padding, y: origin.y - padding }, { x: origin.x + padding, y: origin.y - padding },
    { x: origin.x - padding, y: origin.y + padding }, { x: origin.x + padding, y: origin.y + padding },
    { x: rect.left, y: rect.top }, { x: rect.right, y: rect.top },
    { x: rect.left, y: rect.bottom }, { x: rect.right, y: rect.bottom },
  ].sort((a,b) => a.x-b.x || a.y-b.y);
  const cross = (a: ScreenPoint,b: ScreenPoint,c: ScreenPoint) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half = (items: ScreenPoint[]) => {
    const hull: ScreenPoint[] = [];
    for (const p of items) { while (hull.length > 1 && cross(hull[hull.length-2],hull[hull.length-1],p) <= 0) hull.pop(); hull.push(p); }
    return hull.slice(0,-1);
  };
  const hull = [...half(points), ...half([...points].reverse())];
  return hull.every((p,i) => cross(p,hull[(i+1)%hull.length],current) >= 0);
}
