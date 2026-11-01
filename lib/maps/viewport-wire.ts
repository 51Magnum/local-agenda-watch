import type { MapCase } from "./types";
import type { ViewportData } from "./viewport";

type PackedCase = [string, string, string, MapCase["stage"], MapCase["centroid"], MapCase["geometry"], MapCase["confidence"], string[] | null, MapCase["nextHearing"] | null, string | null, MapCase["popup"] | null, string | null, string | null, (boolean|null)?];
export type PackedViewport = Omit<ViewportData, "cases"> & { format: 1; cases: PackedCase[] };

/** Map transport carries drawing/interaction data, never repeated record links or parcel metadata. */
export function packViewport(data: ViewportData): PackedViewport {
  return { ...data, format: 1, cases: data.cases.map((c) => {const packed:PackedCase=[String(c.id), c.areaId!, c.title, c.stage, c.centroid, c.geometry, c.confidence, c.uses ?? null, c.nextHearing ?? null, c.decisionDate ?? null, c.popup ?? null, c.jurisdictionLabel ?? null, c.timezone ?? null];if(c.aiTitle!==undefined)packed.push(c.aiTitle);return packed;}) };
}
export function unpackViewport(data: PackedViewport): ViewportData {
  return { ...data, cases: data.cases.map(([id, areaId, title, stage, centroid, geometry, confidence, uses, nextHearing, decisionDate, popup, jurisdictionLabel, timezone,aiTitle]) => ({
    id:String(id), areaId, title, stage, centroid, geometry, confidence,
    uses: uses ?? undefined, nextHearing: nextHearing ?? undefined, decisionDate: decisionDate ?? undefined,
    popup: popup ?? undefined, jurisdictionLabel: jurisdictionLabel ?? undefined, timezone: timezone ?? undefined,aiTitle:aiTitle??undefined,
    type: "", typeLabel: "", summary: "", href: "", source: geometry ? "polygon" : "none", citywide: false, flumCategories: [],
  })) };
}

/** Six decimals are sub-meter precision; apply to all numeric transport values. */
export function roundMapPayload<T>(data:T):T {return JSON.parse(JSON.stringify(data,(_key,value)=>typeof value==="number"?Number(value.toFixed(6)):value));}
