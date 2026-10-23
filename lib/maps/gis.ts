import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import { isLonLat, type CaseGeometry, type FlumLegendItem } from "./types";
export async function gisJson(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("GIS HTTP " + response.status);
  const json = await response.json();
  if (json.error) throw new Error("GIS source error " + json.error.code);
  return json;
}
export async function geoQuery(layerUrl: string, options: Record<string, string> = {}): Promise<FeatureCollection> {
  const features: Feature[] = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const params = new URLSearchParams({ where: "1=1", outFields: "*", returnGeometry: "true", outSR: "4326", f: "geojson", resultRecordCount: "1000", resultOffset: String(offset), ...options });
    const body = await gisJson(layerUrl + "/query?" + params);
    if (body.type !== "FeatureCollection" || !Array.isArray(body.features)) throw new Error("Invalid GIS GeoJSON response");
    features.push(...body.features);
    if (!body.exceededTransferLimit && !body.properties?.exceededTransferLimit) return { type: "FeatureCollection", features };
    if (!body.features.length) throw new Error("GIS pagination did not advance");
  }
  throw new Error("GIS response exceeds paging limit");
}
export function polygonGeometry(geometry: Geometry | null): geometry is CaseGeometry {
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return false;
  const positions = geometry.type === "Polygon" ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
  return positions.length > 0 && positions.every(isLonLat);
}
export function combinePolygons(features: Feature<Geometry | null, GeoJsonProperties>[]): CaseGeometry | null {
  const polygons = features.filter((f) => polygonGeometry(f.geometry)).flatMap((f) => f.geometry!.type === "Polygon" ? [(f.geometry as CaseGeometry & { type: "Polygon" }).coordinates] : (f.geometry as CaseGeometry & { type: "MultiPolygon" }).coordinates);
  return polygons.length ? polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons } : null;
}
export function rendererLegend(renderer: { uniqueValueInfos?: { value: string; label?: string; symbol?: { color?: number[] } }[]; uniqueValueGroups?: { classes: { label: string; values: string[][]; symbol?: { color?: number[] } }[] }[] }): FlumLegendItem[] {
  const rows = renderer.uniqueValueInfos ?? renderer.uniqueValueGroups?.flatMap((group) => group.classes.flatMap((c) => c.values.map((values) => ({ value: values[0], label: c.label, symbol: c.symbol })))) ?? [];
  return rows.map((row) => ({ value: String(row.value), label: row.label || String(row.value), color: "rgba(" + (row.symbol?.color ?? [148, 163, 184, 255]).map((v, i) => i === 3 ? v / 255 : v).join(",") + ")" }));
}
export const sqlString = (value: string) => "'" + value.replace(/'/g, "''") + "'";
