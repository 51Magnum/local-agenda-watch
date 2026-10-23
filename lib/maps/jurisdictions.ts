import { getNampaHearings, nampa } from "@/lib/localities/nampa";
import { caseDisplayTitle, caseSummary } from "@/lib/case-details";
import { braeburnCreek, getProjectForCase, projectPathForCase } from "@/lib/projects";
import { CASE_EVIDENCE } from "@/lib/case-evidence";
import type { JurisdictionConfig, MapVisual } from "./types";
const hearingService = "https://utility.arcgis.com/usrsvcs/servers/757f490738bd43da906508745cf92337/rest/services/Public/PZ_Hearings/MapServer";
/** Add one configuration entry to enable another jurisdiction's routes and map. */
export const JURISDICTIONS: Record<string, JurisdictionConfig> = {
  nampa: {
    id: "nampa", name: "Nampa", mapOnHub: true, center: [-116.5635, 43.5739], zoom: 11, bounds: [-116.85, 43.3, -116.3, 43.85], state: { abbreviation: "ID", fips: "16", name: "Idaho" },
    caseGeometry: { layers: [hearingService + "/0", hearingService + "/1"], caseIdField: "APPID", fields: { type: "APPTYPE", phase: "APPPHASE", status: "APPSTATUS", title: "APPSCOPE", acres: "APPACRES", link: "APPLINK" }, parcelFallback: { layerUrl: "https://maps.canyonco.org/arcgisserver/rest/services/Assessor/CCPublicTaxparcels/MapServer/0", matchField: "ACCOUNT", recordField: "MainParcelNumber", ignored: ["R1542600000"] } },
    flum: { layerUrl: "https://utility.arcgis.com/usrsvcs/servers/3543690ae3bf41a1a77b9b9b2bc477ca/rest/services/Public/NampaOpenData/MapServer/30", categoryField: "DESIG", colorSource: "renderer", planName: "Nampa 2040 Comprehensive Plan", label: "Nampa 2040 Comprehensive Plan, Future Land Use (plan update underway in 2026)", adoptedDate: "2020-03", adoptionSource: "https://www.cityofnampa.us/1664/Long-Range-Planning-Comprehensive-Plan", dataNote: "City planning page: adopted March 2020. GIS layer metadata says its underlying data was adopted in 2019; it may lag plan amendments.", simplifyTolerance: 0.00002 },
    addressPoints: { layerUrl: "https://utility.arcgis.com/usrsvcs/servers/2cb0c34984644eb19ebeb3f8a17b7dc9/rest/services/Public/CityInformation_Public/MapServer/35", addressField: "SiteAddres", where: "UPPER(SiteCity) = 'NAMPA' AND SiteState = 'ID'", suffix: "Nampa, ID" },
    stages: { phase: { Review: "In review", Notification: "In review", "PZ Commission": "P&Z", "City Council": "Council/Board", Recording: "Decided" }, status: { Submitted: "Filed", Pending: "In review", Approved: "Decided", Denied: "Decided", Withdrawn: "Decided", Closed: "Decided", Complete: "Decided", Completed: "Decided" }, recorded: { phases: ["Recording"], statuses: ["Complete", "Recorded"] } },
    caseTypes: { ANN: "Annexation", SPP: "Preliminary plat", SPF: "Final plat", MPC: "Master plan", CUP: "Conditional use permit", ZMA: "Rezone", ZTA: "Zoning text amendment", CTA: "Comprehensive plan text amendment", CMA: "Comprehensive plan map amendment", VAR: "Variance" }, citywideTypes: ["ZTA", "CTA"],
    caseVisuals: {
      ...Object.fromEntries(braeburnCreek.caseIds.map((id) => [id, {
        src: "/nampa/braeburn-concept-preview.webp", fullSizeUrl: "/nampa/toll-brothers-concept-plan.webp",
        alt: "Detail of the developer concept for Braeburn Creek showing proposed lots, streets and shared spaces",
        label: "Developer concept · March 13, 2026", note: "Detail crop. Early concept; later submissions may differ.",
        sourceUrl: "/nampa/toll-brothers-concept-plan.png", kind: "proposal",
      } satisfies MapVisual])),
      ...Object.fromEntries(Object.entries(CASE_EVIDENCE).flatMap(([id, evidence]) => {
        const visual = evidence.visuals?.[0]; if (!visual || !evidence.reportUrl) return [];
        return [[id, { src: visual.src, fullSizeUrl: visual.src, alt: visual.alt, label: visual.title + " · staff report", note: "Planning context, not a proposed site layout.", sourceUrl: evidence.reportUrl + "#page=" + visual.sourcePage, kind: "context" } satisfies MapVisual]];
      })),
    },
    loadCases: getNampaHearings, recordClient: nampa.energov,
    presentation: (hearing, plan) => ({ title: caseDisplayTitle(hearing, plan), summary: caseSummary(hearing, plan), href: "/nampa" + projectPathForCase(hearing.appId), hearing: getProjectForCase(hearing.appId)?.nextHearing }),
  },
};
export function getJurisdiction(id: string): JurisdictionConfig | undefined { return Object.hasOwn(JURISDICTIONS, id) ? JURISDICTIONS[id] : undefined; }
