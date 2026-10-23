import { isLonLat } from "@/lib/maps/types";
import { getJurisdiction } from "@/lib/maps/jurisdictions";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  try {
    const body = await request.json();
    const config = typeof body.jurisdiction === "string" ? getJurisdiction(body.jurisdiction) : undefined;
    const address = typeof body.address === "string" ? body.address.trim() : "";
    if (!config || address.length < 3 || address.length > 200) return Response.json({ error: "Enter a street address." }, { status: 400, headers });
    // POST keeps the address out of this site's URL/access logs. No database,
    // server cache, analytics or console logging receives the submitted address.
    const params = new URLSearchParams({ address: address + (new RegExp("\\b" + config.state.abbreviation + "\\b", "i").test(address) ? "" : ", " + config.addressPoints.suffix), benchmark: "Public_AR_Current", format: "json" });
    const response = await fetch("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?" + params, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Geocoder unavailable");
    const json = await response.json();
    const results = (json.result?.addressMatches ?? []).filter((m: { addressComponents?: { state?: string }; coordinates?: { x?: number; y?: number } }) => m.addressComponents?.state === config.state.abbreviation && Number.isFinite(m.coordinates?.x) && Number.isFinite(m.coordinates?.y) && isLonLat([m.coordinates!.x!, m.coordinates!.y!])).map((m: { matchedAddress: string; coordinates: { x: number; y: number } }) => ({ label: m.matchedAddress, coordinates: [m.coordinates.x, m.coordinates.y], source: "Census" }));
    return Response.json({ results }, { headers });
  } catch { return Response.json({ error: "Address lookup temporarily unavailable. Try again or explore the map." }, { status: 503, headers }); }
}
