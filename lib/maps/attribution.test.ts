import {readFileSync} from "node:fs";
import {expect, it, vi} from "vitest";
import {addMapAttribution} from "./attribution";
import type {Map as LibreMap} from "maplibre-gl";

function fixture() {
  const classes = new Set(["maplibregl-compact-show"]);
  const element = {classList: {add: (...names: string[]) => names.forEach(n => classes.add(n)), remove: (name: string) => classes.delete(name)}, removeAttribute: vi.fn()};
  class Attribution {
    options: unknown;
    constructor(options: unknown) { this.options = options; }
    onAdd() { return element; }
  }
  const attached = new Set<unknown>();
  const map = {hasControl: (control: unknown) => attached.has(control), addControl: vi.fn((control: Attribution) => { attached.add(control); control.onAdd(); })};
  return {map, lib: {AttributionControl: Attribution}, classes, element, attached};
}
const install = (f: ReturnType<typeof fixture>) => addMapAttribution(f.map as unknown as LibreMap, f.lib as unknown as Parameters<typeof addMapAttribution>[1]);
it("adds exactly one control even when initialization runs twice", () => {
  const f = fixture(), control = install(f); expect(install(f)).toBe(control);
  expect(f.map.addControl).toHaveBeenCalledOnce();
  expect(f.map.addControl).toHaveBeenCalledWith(control, "top-right");
});
it("keeps each map independent and can replace a removed control", () => {
  const first = fixture(), second = fixture(); expect(install(first)).not.toBe(install(second));
  first.attached.clear(); install(first); expect(first.map.addControl).toHaveBeenCalledTimes(2);
});
it("starts compact and collapsed while preserving all required linked credits", () => {
  const f = fixture(), control = install(f);
  expect(f.classes.has("maplibregl-compact")).toBe(true);
  expect(f.classes.has("maplibregl-compact-show")).toBe(false);
  expect(f.element.removeAttribute).toHaveBeenCalledWith("open");
  for (const credit of ["OpenFreeMap", "OpenMapTiles", "OpenStreetMap"]) expect(control.options.customAttribution).toContain(credit);
  expect(control.options.compact).toBe(true);
});
it.each(["app/components/maps/map-home.tsx", "app/components/maps/case-map.tsx", "app/components/locations/coverage-map.tsx", "app/admin/jurisdictions/preview-map.tsx"])("uses the single attribution owner on %s", file => {
  const source = readFileSync(file, "utf8");
  expect(source).toMatch(/attributionControl:\s*false/);
  expect(source).toMatch(/addMapAttribution\((?:m|map|instance),\s*lib\)/);
  expect(source).not.toContain("new lib.AttributionControl");
});
