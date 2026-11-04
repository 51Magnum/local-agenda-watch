import type {AttributionControl, Map as LibreMap} from "maplibre-gl";

const controls = new WeakMap<LibreMap, AttributionControl>();
const credits = '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/** All map constructors disable automatic attribution; this is the sole owner. */
export function addMapAttribution(map: LibreMap, lib: Pick<typeof import("maplibre-gl"), "AttributionControl">) {
  const existing = controls.get(map);
  if (existing && map.hasControl(existing)) return existing;
  class CompactAttribution extends lib.AttributionControl {
    onAdd(instance: LibreMap) {
      const element = super.onAdd(instance);
      // MapLibre 6 compact mode starts expanded, even with compact:true.
      element.classList.add("law-map-attribution", "maplibregl-compact");
      element.classList.remove("maplibregl-compact-show");
      element.removeAttribute("open");
      return element;
    }
  }
  const control = new CompactAttribution({compact: true, customAttribution: credits});
  controls.set(map, control);
  // Above mobile bottom sheets; stacks below the navigation buttons.
  map.addControl(control, "top-right");
  return control;
}
