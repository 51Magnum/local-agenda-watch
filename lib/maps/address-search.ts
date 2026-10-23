import type { AddressResult, JurisdictionConfig } from "./types";
import { isLonLat } from "./types";
import { sqlString } from "./gis";
const PREFIX = "law-map-search:";
export type AddressSearchConfig = Pick<JurisdictionConfig, "id" | "addressPoints" | "state">;
export function addressWhere(config: AddressSearchConfig, input: string): string {
  const abbreviations: Record<string, string> = { BOULEVARD: "BLVD", AVENUE: "AVE", STREET: "ST", ROAD: "RD", DRIVE: "DR", LANE: "LN", NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W" };
  const tokens = input.split(",")[0].toUpperCase().replace(/[%_]/g, " ").split(/\s+/).filter(Boolean).slice(0, 12).map((s) => abbreviations[s] ?? s);
  return "(" + config.addressPoints.where + ") AND UPPER(" + config.addressPoints.addressField + ") LIKE " + sqlString("%" + tokens.join("%") + "%");
}
export async function searchAddress(config: AddressSearchConfig, address: string): Promise<AddressResult[]> {
  const key = PREFIX + config.id + ":" + address.trim().toUpperCase();
  try { const saved = JSON.parse(sessionStorage.getItem(key) ?? "null"); if (saved?.expires > Date.now()) return saved.results; } catch { /* Private browsing can disable browser storage. */ }
  let results: AddressResult[] = [];
  try {
    const params = new URLSearchParams({ where: addressWhere(config, address), outFields: config.addressPoints.addressField, returnGeometry: "true", outSR: "4326", f: "geojson", resultRecordCount: "6" });
    const response = await fetch(config.addressPoints.layerUrl + "/query?" + params, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("Address points unavailable");
    const json = await response.json();
    if (json.error) throw new Error("Address points unavailable");
    results = (json.features ?? []).filter((f: { geometry?: { type: string; coordinates: number[] } }) => f.geometry?.type === "Point" && isLonLat(f.geometry.coordinates)).map((f: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }) => ({ label: f.properties[config.addressPoints.addressField] + ", " + config.addressPoints.suffix, coordinates: f.geometry.coordinates.slice(0, 2) as [number, number], source: "local" }));
  } catch { /* Census is an independent fallback. No address is logged. */ }
  if (!results.length) {
    const response = await fetch("/api/maps/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ jurisdiction: config.id, address }) });
    const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Address lookup unavailable"); results = json.results;
  }
  try {
    const entries = Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX));
    if (entries.length >= 30) sessionStorage.removeItem(entries[0]);
    sessionStorage.setItem(key, JSON.stringify({ expires: Date.now() + 24 * 3600000, results }));
  } catch { /* Caching is optional and stays on this browser. */ }
  return results;
}
export function readSharedSearch(hash: string): AddressResult | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, "")), lng = Number(params.get("lng")), lat = Number(params.get("lat"));
  if (!params.get("lng")?.trim() || !params.get("lat")?.trim() || !isLonLat([lng, lat])) return undefined;
  return { label: (params.get("address") || "Shared location").slice(0, 200), coordinates: [lng, lat], source: params.get("pin") === "1" ? "map" : "local" };
}
export function searchHash(result: AddressResult): string { return "#" + new URLSearchParams({ address: result.label, lng: result.coordinates[0].toFixed(6), lat: result.coordinates[1].toFixed(6), ...(result.source === "map" ? { pin: "1" } : {}) }); }

export function createMapPin(coordinates: [number, number]): AddressResult {
  if (!isLonLat(coordinates)) throw new Error("Invalid pin coordinates");
  return { label: "Map pin (" + coordinates[1].toFixed(5) + ", " + coordinates[0].toFixed(5) + ")", coordinates, source: "map" };
}
