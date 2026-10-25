import {indexedDecisionDate} from "./case-index";
import { canonicalAreaHref } from "@/lib/areas/registry";
import { bbox, feature, simplify } from "@turf/turf";
import type { Feature } from "geojson";
import type { Hearing } from "@/lib/localities/types";
import { caseCatalog } from "@/lib/case-catalog";
import { isStatusUnclear } from "@/lib/localities/stages";
import { combinePolygons, geoQuery, gisJson, polygonGeometry, rendererLegend, sqlString } from "./gis";
import { flumAtGeometry, geometryCentroid } from "./spatial";
import { readMapSnapshot, saveMapSnapshot } from "./store";
import { JURISDICTIONS } from "./jurisdictions";
import type { CaseGeometry, FlumCache, JurisdictionConfig, MapCase, MapSnapshot, MapStage, PublicMapData } from "./types";
const WEEK = 7 * 24 * 3600000;
const inFlight = new Map<string, Promise<MapSnapshot>>();
export function normalizeMapStage(config: JurisdictionConfig, hearing: Hearing): MapStage {
  if (config.stageForCase) return config.stageForCase(hearing);
  const latest = hearing.meetings.filter((m) => /council|board/i.test(m.body) && (m.result || m.continuedNote)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const decision = latest?.result && /^(approved|denied)\b/i.test(latest.result.trim()) ? latest : undefined;
  if (decision && /^denied/i.test(decision.result!)) return "Decided";
  if (config.stages.recorded.phases.includes(hearing.appPhaseRaw) && config.stages.recorded.statuses.includes(hearing.appStatus)) return "Recorded";
  if (decision || hearing.decisionRecorded) return "Decided";
  return config.stages.phase[hearing.appPhaseRaw] ?? config.stages.status[hearing.appStatus] ?? "Filed";
}
export function parcelNumbers(value: unknown, ignored: string[]): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.toUpperCase().split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^[A-Z0-9-]{3,40}$/.test(s) && !ignored.includes(s)))];
}
async function fetchFlum(config: JurisdictionConfig): Promise<FlumCache> {
  const [metadata, source] = await Promise.all([gisJson(config.flum.layerUrl + "?f=json"), geoQuery(config.flum.layerUrl, { outFields: config.flum.categoryField, geometryPrecision: "6" })]);
  const features = source.features.filter((f) => polygonGeometry(f.geometry)).map((f) => {
    const original = feature(f.geometry as CaseGeometry, { [config.flum.categoryField]: f.properties?.[config.flum.categoryField] });
    try { return simplify(original, { tolerance: config.flum.simplifyTolerance, highQuality: true }); } catch { return original; }
  });
  return { updatedAt: new Date().toISOString(), geojson: { type: "FeatureCollection", features }, legend: rendererLegend(metadata.drawingInfo?.renderer ?? {}) };
}
function hearingFromFeature(config: JurisdictionConfig, item: Feature): Hearing {
  const p = item.properties ?? {}, fields = config.caseGeometry.fields;
  const id = String(p[config.caseGeometry.caseIdField] ?? "").trim().toUpperCase();
  const link = fields.link && p[fields.link] ? String(p[fields.link]) : null;
  return { appId: id, appType: String(p[fields.type] ?? ""), appTypeLabel: config.caseTypes[String(p[fields.type])] ?? String(p[fields.type] ?? "Planning case"), appStatus: String(p[fields.status] ?? ""), appPhase: "Other", appPhaseRaw: String(p[fields.phase] ?? ""), appScope: p[fields.title] ? String(p[fields.title]) : null, appAcres: fields.acres && Number.isFinite(p[fields.acres]) ? Number(p[fields.acres]) : null, externalUrl: link, energovPlanId: link?.match(/\/plan\/([a-f0-9-]{36})/i)?.[1] ?? null, meetings: [] };
}
export async function buildMapSnapshot(config: JurisdictionConfig, previous?: MapSnapshot, options: { deadline?: number } = {}): Promise<MapSnapshot> {
  const deadline = options.deadline ?? Date.now() + 70000, now = new Date(), warnings: string[] = [];
  const oldCases = new Map(previous?.cases.map((c) => [c.id, c]));
  const [layers, feed, flum] = await Promise.all([
    Promise.all(config.caseGeometry.layers.map(async (url) => { try { return { url, data: await geoQuery(url, config.caseGeometry.where ? { where: config.caseGeometry.where } : {}) }; } catch { warnings.push("A case boundary layer is unavailable; existing cached outlines are retained."); return { url, data: undefined }; } })),
    config.loadCases?.().catch(() => { warnings.push("The case schedule is unavailable; source layer records are shown."); return undefined; }),
    previous?.flum && Date.now() - Date.parse(previous.flum.updatedAt) < WEEK ? Promise.resolve(previous.flum) : config.flum.layerUrl ? fetchFlum(config).catch(() => { warnings.push("Future land use is temporarily unavailable or out of date."); return previous?.flum; }) : Promise.resolve(undefined),
  ]);
  const hearings = new Map(caseCatalog(feed).map((h) => [h.appId, h]));
  const retained = new Set<string>();
  const polygons = new Map<string, { features: Feature[]; url: string; parcel?: unknown }>();
  for (const layer of layers) for (const item of layer.data?.features ?? []) for (const source of config.parseFeatures?.(item) ?? [config.parseFeature?.(item) ?? hearingFromFeature(config, item)]) { if (!source.appId) continue;
    if (!hearings.has(source.appId)) hearings.set(source.appId, source);
    const existing = polygons.get(source.appId);
    if (!existing || existing.url === layer.url) polygons.set(source.appId, { url: layer.url, features: [...(existing?.features ?? []), item], parcel: config.caseGeometry.fields.parcel ? item.properties?.[config.caseGeometry.fields.parcel] : undefined });
  }
  // Preserve outlines during an upstream outage, without reclassifying them as newly verified.
  if (layers.some((l) => !l.data)) for (const old of previous?.cases ?? []) if (!hearings.has(old.id)) {
    retained.add(old.id);
    hearings.set(old.id, { appId: old.id, appType: old.type, appTypeLabel: old.typeLabel, appStatus: "", appPhase: "Other", appPhaseRaw: "", appScope: old.title, appAcres: null, externalUrl: null, energovPlanId: null, meetings: [] });
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(now);
  const cases: MapCase[] = [];
  const inputs = [...hearings.values()].sort((a,b)=>(oldCases.get(a.appId)?.visualCheckedAt??"").localeCompare(oldCases.get(b.appId)?.visualCheckedAt??""));
  for (let offset = 0; offset < inputs.length; offset += 4) await Promise.all(inputs.slice(offset, offset + 4).map(async (hearing) => {
    const polygon = polygons.get(hearing.appId), old = oldCases.get(hearing.appId);
    if (retained.has(hearing.appId) && old) { cases.push(old); return; }
    const citywide = config.isCitywide?.(hearing) ?? config.citywideTypes.includes(hearing.appType);
    let geometry = citywide ? null : combinePolygons(polygon?.features ?? []);
    let source: MapCase["source"] = geometry ? "polygon" : "none", confidence: MapCase["confidence"] = citywide ? "citywide" : geometry ? "exact" : "approximate", sourceUrl = geometry ? polygon?.url : undefined;
    let plan = null;
    let parcelIds=config.parcelNumbersForCase?.(hearing)??parcelNumbers(polygon?.parcel,config.caseGeometry.parcelFallback.ignored);
    let geometryUpdatedAt = geometry ? now.toISOString() : undefined;
    if (!citywide && !geometry) {
      let parcels = config.parcelNumbersForCase?.(hearing) ?? parcelNumbers(polygon?.parcel, config.caseGeometry.parcelFallback.ignored);
      if (!parcels.length && hearing.energovPlanId && config.recordClient && Date.now() < deadline - 16000) {
        try { plan = await config.recordClient.getPlan(hearing.energovPlanId, { revalidate: 3600 }); parcels = parcelNumbers((plan as unknown as Record<string, unknown> | null)?.[config.caseGeometry.parcelFallback.recordField], config.caseGeometry.parcelFallback.ignored); } catch { /* No guessed pin when the city case record cannot be read. */ }
      }
      parcelIds=parcels;
      if (parcels.length && Date.now() < deadline - 15000) {
        try {
          const fallback = config.caseGeometry.parcelFallback;
          const matched = await geoQuery(fallback.layerUrl, { where: fallback.matchField + " IN (" + parcels.map(sqlString).join(",") + ")", outFields: fallback.matchField });
          geometry = combinePolygons(matched.features.filter((f) => parcels.includes(String(f.properties?.[fallback.matchField]).toUpperCase())));
          if (geometry) { source = "parcel match"; confidence = "approximate"; sourceUrl = fallback.layerUrl; geometryUpdatedAt = now.toISOString(); }
        } catch { warnings.push("Some parcel outlines could not be refreshed."); }
      }
      if (!geometry && old?.geometry && old.source === "parcel match") { geometry = old.geometry; source = old.source; confidence = old.confidence; sourceUrl = old.sourceUrl; geometryUpdatedAt = old.geometryUpdatedAt; }
      if (!geometry && old?.geometry && layers.some((l) => !l.data)) { geometry = old.geometry; source = old.source; confidence = old.confidence; sourceUrl = old.sourceUrl; geometryUpdatedAt = old.geometryUpdatedAt; }
    }
    const visual = old?.visual, visualCheckedAt = old?.visualCheckedAt;
    let stage = normalizeMapStage(config, hearing);
    const meeting = hearing.meetings.filter((m) => !m.continuedNote && m.date >= today && (stage !== "Council/Board" || /council|board/i.test(m.body))).sort((a, b) => a.date.localeCompare(b.date))[0];
    const presentation = config.presentation?.(hearing, plan);
    const curated = presentation?.hearing;
    const next = meeting ? { date: meeting.date, body: meeting.bodyLabel, label: meeting.bodyLabel + " hearing " + meeting.dateLabel } : curated && curated.startsAt.slice(0, 10) >= today ? { date: curated.startsAt.slice(0, 10), body: curated.body, label: curated.body + " hearing " + new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" }).format(new Date(curated.startsAt)) } : undefined;
    if (next && stage !== "Decided" && stage !== "Recorded") stage = /council|board/i.test(next.body) ? "Council/Board" : "P&Z";
    const summary = presentation?.summary ?? hearing.appScope ?? hearing.appTypeLabel;
    const oneLine = summary.split(/(?<=\.)\s+/).find((s) => /propos|annexation|plat|permit|rezone|amendment/i.test(s)) ?? summary;
    cases.push({ decisionDate:stage==="Decided"?indexedDecisionDate(hearing):undefined,stageBody:meeting?.bodyLabel??[...hearing.meetings].filter(m=>stage!=="Council/Board"||m.body===config.area?.bodies.decision.id).sort((a,b)=>b.date.localeCompare(a.date))[0]?.bodyLabel,bounds:geometry?bbox(geometry).slice(0,4) as [number,number,number,number]:undefined,parcelIds,parcelNamespace:config.caseGeometry.parcelFallback.layerUrl?new URL(config.caseGeometry.parcelFallback.layerUrl).hostname:undefined,id: hearing.appId, title: presentation?.title ?? hearing.appTypeLabel + " — " + hearing.appId, summary: oneLine, type: hearing.appType, typeLabel: config.caseTypes[hearing.appType] ?? hearing.appTypeLabel, stage, ...(isStatusUnclear(hearing) ? { statusNote: "Status unclear, no recent city record" } : {}), href: presentation?.href ?? "/" + config.id + "/plan/" + encodeURIComponent(hearing.appId), ...((stage !== "Decided" && stage !== "Recorded" && next) ? { nextHearing: next } : {}), geometry, centroid: geometry ? geometryCentroid(geometry) : null, source, confidence, sourceUrl, geometryUpdatedAt, visual, visualCheckedAt, citywide, flumCategories: geometry && flum ? flumAtGeometry(geometry, flum.geojson, config.flum.categoryField) : [] });
  }));
  return { version: 1, jurisdiction: config.id, updatedAt: now.toISOString(), cases: cases.sort((a, b) => a.id.localeCompare(b.id)), flum, warnings: [...new Set(warnings)] };
}
export async function refreshJurisdiction(config: JurisdictionConfig, deadline?: number): Promise<MapSnapshot> {
  const running = inFlight.get(config.id); if (running) return running;
  const task = (async () => { const previous = await readMapSnapshot(config.id); const snapshot = await buildMapSnapshot(config, previous, { deadline }); await saveMapSnapshot(snapshot); return snapshot; })().finally(() => inFlight.delete(config.id));
  inFlight.set(config.id, task); return task;
}
export async function refreshConfiguredMaps(deadline = Date.now() + 50000) {
  // Each area starts independently so a slow city's reports cannot starve another area.
  return Promise.all(Object.values(JURISDICTIONS).map(async config => {
    try { const snapshot = await refreshJurisdiction(config, deadline); return { jurisdiction: config.id, cases: snapshot.cases.length, mapped: snapshot.cases.filter((c) => c.geometry).length, citywide: snapshot.cases.filter((c) => c.citywide).length, warnings: snapshot.warnings.length }; }
    catch { console.error("[maps] Refresh unavailable for " + config.id); return { jurisdiction: config.id, unavailable: true }; }
  }));
}

export function publicMapData(config: JurisdictionConfig, snapshot: MapSnapshot): PublicMapData {
  const { id, name, center, zoom, bounds, state, addressPoints } = config;
  return { jurisdiction: { id, name, center, zoom, bounds, state, addressPoints }, updatedAt: snapshot.updatedAt, cases: snapshot.cases.map((c) => ({ ...c, href: canonicalAreaHref(config.id,c.href), visual: undefined })), warnings: snapshot.warnings, flum: { ...config.flum, updatedAt: snapshot.flum?.updatedAt, legend: snapshot.flum?.legend ?? [] } };
}
