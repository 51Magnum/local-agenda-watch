import { publicJurisdictions, jurisdiction } from "../jurisdictions/registry";
import { configuredMap } from "../jurisdictions/runtime";
import { legacyAdapters } from "../jurisdictions/adapters/legacy";
import { meridianPublicRecord } from "@/lib/sources/meridian-record";
import { MUNICIPAL_IDS, MUNICIPAL_SOURCES } from "@/lib/sources/municipal-config";
import { MUNICIPAL_FEEDS } from "@/lib/localities/municipal";
import { municipalRecord, municipalCaseIds, municipalFromFeature, municipalStage, municipalTitle, municipalSummary, type MunicipalCase } from "@/lib/sources/municipal";
import { getMeridianHearings } from "@/lib/localities/meridian";
import { meridianFromFeature, meridianStage, meridianTitle, meridianSummary } from "@/lib/sources/meridian";
import { getCanyonCountyHearings } from "@/lib/localities/canyon-county";
import { type CountyCase, countyFromFeature, countyCaseWhere, countyStage, countyTitle, countySummary } from "@/lib/sources/canyon-county";
import { AREAS, areaPath } from "@/lib/areas/registry";
import { getNampaVisualReports } from "@/lib/sources/primegov";
import { getNampaHearings, nampa } from "@/lib/localities/nampa";
import { caseDisplayTitle, caseSummary } from "@/lib/case-details";
import { braeburnCreek, getProjectForCase, projectPathForCase } from "@/lib/projects";
import { CASE_EVIDENCE } from "@/lib/case-evidence";
import type { JurisdictionConfig, MapVisual } from "./types";
/** Add one configuration entry to enable another jurisdiction's routes and map. */
const LEGACY_PLATFORM_CONFIGS: Record<string, Partial<JurisdictionConfig>> = {
    ...Object.fromEntries(MUNICIPAL_IDS.map(id => {
        const s = MUNICIPAL_SOURCES[id];
        return [jurisdiction(id).agenda[0].adapter, {
                isCitywide: h => h.citywide === true, recordForCase: municipalRecord, loadCases: MUNICIPAL_FEEDS[id], loadCaseDocuments: (caseId, context) => import("./image-documents").then(m => m.loadCaseDocuments(id, caseId, context)),
                parcelNumbersForCase: id === "star" ? h => (h as MunicipalCase).municipal.parcelIds ?? [] : undefined, parseFeatures: f => municipalCaseIds(id, String(f.properties?.[s.caseField] ?? "")).map(caseId => municipalFromFeature(id, f, caseId)), stageForCase: municipalStage, presentation: h => ({ title: municipalTitle(h), summary: municipalSummary(h), href: areaPath(AREAS[id]) + "/plan/" + encodeURIComponent(h.appId) })
            } satisfies Partial<JurisdictionConfig>];
    })),
    primegov: {
        reviewedApplications: Object.fromEntries(Object.entries(CASE_EVIDENCE).flatMap(([id, e]) => e.applicationCopy && e.reportUrl ? [[id, { ...e.applicationCopy, reportUrl: e.reportUrl }]] : [])),
        caseVisuals: {
            ...Object.fromEntries(braeburnCreek.caseIds.map((id) => [id, {
                    src: "/us/id/nampa/braeburn-concept-preview.webp", fullSizeUrl: "/us/id/nampa/toll-brothers-concept-plan.webp",
                    alt: "Detail of the developer concept for Braeburn Creek showing proposed lots, streets and shared spaces",
                    label: "Developer concept · March 13, 2026", note: "Detail crop. Early concept; later submissions may differ.",
                    sourceUrl: "/us/id/nampa/toll-brothers-concept-plan.png", kind: "proposal"
                } satisfies MapVisual])),
            ...Object.fromEntries(Object.entries(CASE_EVIDENCE).flatMap(([id, evidence]) => {
                const visual = evidence.visuals?.[0];
                if (!visual || !evidence.reportUrl)
                    return [];
                return [[id, { src: visual.src, fullSizeUrl: visual.src, alt: visual.alt, label: visual.title + " · staff report", note: "Planning context, not a proposed site layout.", sourceUrl: evidence.reportUrl + "#page=" + visual.sourcePage, kind: "context" } satisfies MapVisual]];
            }))
        },
        loadCaseDocuments: (caseId, context) => import("./image-documents").then(m => m.loadCaseDocuments("nampa", caseId, context)), loadCases: getNampaHearings, loadCaseReports: getNampaVisualReports, recordClient: nampa.energov,
        recordForCase: async (h) => { if (!h.energovPlanId)
            return; const p = await nampa.energov!.getPlan(h.energovPlanId, { timeoutMs: 1500 }).catch(() => null); if (!p || JURISDICTIONS.nampa.caseGeometry.parcelFallback.ignored.includes(p.MainParcelNumber ?? ""))
            return; return { address: p.MainAddress ?? "", sourceStatus: p.PlanStatus, approvalStatus: "", events: [] }; },
        presentation: (hearing, plan) => ({ title: caseDisplayTitle(hearing, plan), summary: caseSummary(hearing, plan), href: areaPath(AREAS.nampa) + projectPathForCase(hearing.appId), hearing: getProjectForCase(hearing.appId)?.nextHearing })
    },
    municipalClerk: {
        isCitywide: h => h.citywide === true, loadCaseDocuments: (caseId, context) => import("./image-documents").then(m => m.loadCaseDocuments("meridian", caseId, context)), recordForCase: meridianPublicRecord, loadCases: getMeridianHearings, parseFeature: meridianFromFeature, stageForCase: h => meridianStage(h) as import("./types").MapStage, presentation: h => ({ title: meridianTitle(h), summary: meridianSummary(h), href: areaPath(AREAS.meridian) + "/plan/" + encodeURIComponent(h.appId) })
    },
    countyLandHearings: {
        isCitywide: h => h.citywide === true, loadCaseDocuments: (caseId, context) => import("./image-documents").then(m => m.loadCaseDocuments("canyon-county", caseId, context)), recordForCase: h => (h as CountyCase).county, loadCases: getCanyonCountyHearings, parseFeature: countyFromFeature,
        stageForCase: hearing => { const stage = countyStage(hearing); return stage === "Hearing Examiner" ? "P&Z" : stage as import("./types").MapStage; },
        presentation: hearing => ({ title: countyTitle(hearing), summary: countySummary(hearing), href: areaPath(AREAS["canyon-county"]) + "/plan/" + encodeURIComponent(hearing.appId) })
    }
};
export const JURISDICTIONS: Record<string, JurisdictionConfig> = Object.fromEntries(publicJurisdictions().map(d => {
    if (!d.legacyPublic)
        return [d.id, configuredMap(d.id)];
    const base = LEGACY_PLATFORM_CONFIGS[d.agenda[0].adapter];
    if (!base)
        throw Error("Missing registered legacy platform " + d.agenda[0].adapter);
    const runtime = d.legacyRuntime as unknown as JurisdictionConfig;
    const where = d.agenda[0].adapter === "countyLandHearings" ? countyCaseWhere() : d.agenda[0].adapter === "civicplusArchive" ? "Active_Application = 'Y' OR Case_No LIKE '%" + String(new Date().getFullYear()).slice(2) + "-%' OR Case_No LIKE '%" + String(new Date().getFullYear() - 1).slice(2) + "-%'" : runtime.caseGeometry.where;
    return [d.id, { ...base, ...runtime, caseGeometry: { ...runtime.caseGeometry, ...(where ? {where} : {}) }, area: AREAS[d.id], id: d.id, name: d.name, center: d.area.center, state: { abbreviation: d.state.toUpperCase(), fips: "16", name: d.area.stateName }, loadCases: base.loadCases ? () => legacyAdapters(d, base.loadCases!).feed() : undefined } as JurisdictionConfig];
}));
export function getJurisdiction(id: string): JurisdictionConfig | undefined { return Object.hasOwn(JURISDICTIONS, id) ? JURISDICTIONS[id] : undefined; }
