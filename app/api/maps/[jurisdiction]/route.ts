import { getJurisdiction } from "@/lib/maps/jurisdictions";
import { readFlumSnapshot,readMapSnapshot } from "@/lib/maps/store";
import { publicMapData, refreshJurisdiction } from "@/lib/maps/refresh";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: Request, { params }: { params: Promise<{ jurisdiction: string }> }) {
  const config = getJurisdiction((await params).jurisdiction);
  if (!config) return Response.json({ error: "Jurisdiction not configured" }, { status: 404 });
  try {
    const query=new URL(request.url).searchParams;
    const flum=query.get("layer")==="flum";
    if(flum){const data=await readFlumSnapshot(config.id)??(await refreshJurisdiction(config)).flum;return data?Response.json(data,{headers:{"Cache-Control":"public, max-age=3600, s-maxage=3600"}}):Response.json({error:"Future land use temporarily unavailable"},{status:503});}
    const caseIds=query.get("cases")?.split(",").filter(Boolean).slice(0,30);
    const snapshot = await readMapSnapshot(config.id,{caseIds,includeFlum:false}) ?? await refreshJurisdiction(config);
    if (flum && !snapshot.flum) return Response.json({ error: "Future land use temporarily unavailable" }, { status: 503 });
    return Response.json(flum ? snapshot.flum : publicMapData(config, snapshot), { headers: { "Cache-Control": flum ? "public, max-age=3600, s-maxage=3600" : "public, max-age=300, s-maxage=300" } });
  } catch (error) {
    const failure = error as { name?: string; code?: string; message?: string; stack?: string };
    console.error("[map-data] Request failed", { jurisdiction: config.id, name: failure.name, code: failure.code, reason: failure.name === "TypeError" ? failure.message?.match(/Cannot read properties of (?:undefined|null) \(reading '[a-zA-Z]+'\)|[a-zA-Z_$][a-zA-Z0-9_.$]* is not (?:a function|a constructor|iterable)/)?.[0] : undefined, frames: failure.stack?.split("\n").slice(1, 4) });
    return Response.json({ error: "Map data temporarily unavailable. The case list and official GIS sources remain available." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
