import {getMeridianHearings}from "@/lib/localities/meridian";
import {MERIDIAN_WHERE,MERIDIAN_TYPES,meridianFromFeature,meridianStage,meridianTitle,meridianSummary}from "@/lib/sources/meridian";
import { getCanyonCountyHearings } from "@/lib/localities/canyon-county";
import { countyFromFeature, countyCaseWhere, countyStage, countyTitle, countySummary, COUNTY_TYPES } from "@/lib/sources/canyon-county";
import { AREAS, areaPath } from "@/lib/areas/registry";
import { getNampaVisualReports } from "@/lib/sources/primegov";
import { getNampaHearings, nampa } from "@/lib/localities/nampa";
import { caseDisplayTitle, caseSummary } from "@/lib/case-details";
import { braeburnCreek, getProjectForCase, projectPathForCase } from "@/lib/projects";
import { CASE_EVIDENCE } from "@/lib/case-evidence";
import type { JurisdictionConfig, MapVisual } from "./types";

/** Add one configuration entry to enable another jurisdiction's routes and map. */
export const JURISDICTIONS: Record<string, JurisdictionConfig> = {
  nampa: {
    area: AREAS.nampa, id: AREAS.nampa.id, name: AREAS.nampa.name, mapOnHub: true, center: AREAS.nampa.center, zoom: 11, bounds: [-116.85, 43.3, -116.3, 43.85], state: { abbreviation: "ID", fips: "16", name: "Idaho" },
    caseGeometry: { layers: AREAS.nampa.sources.geometry!, caseIdField: "APPID", fields: { type: "APPTYPE", phase: "APPPHASE", status: "APPSTATUS", title: "APPSCOPE", acres: "APPACRES", link: "APPLINK" }, parcelFallback: { layerUrl: AREAS.nampa.sources.parcelFallback!, matchField: "ACCOUNT", recordField: "MainParcelNumber", ignored: ["R1542600000"] } },
    flum: { layerUrl: AREAS.nampa.sources.flum!, categoryField: "DESIG", colorSource: "renderer", planName: "Nampa 2040 Comprehensive Plan", label: "Nampa 2040 Comprehensive Plan, Future Land Use (plan update underway in 2026)", adoptedDate: "2020-03", adoptionSource: "https://www.cityofnampa.us/1664/Long-Range-Planning-Comprehensive-Plan", dataNote: "City planning page: adopted March 2020. GIS layer metadata says its underlying data was adopted in 2019; it may lag plan amendments.", simplifyTolerance: 0.00002 },
    addressPoints: { layerUrl: AREAS.nampa.sources.addressPoints!, ...AREAS.nampa.addressSearch! },
    stages: { phase: { Review: "In review", Notification: "In review", "PZ Commission": "P&Z", "City Council": "Council/Board", Recording: "Decided" }, status: { Submitted: "Filed", Pending: "In review", Approved: "Decided", Denied: "Decided", Withdrawn: "Decided", Closed: "Decided", Complete: "Decided", Completed: "Decided" }, recorded: { phases: ["Recording"], statuses: ["Complete", "Recorded"] } },
    caseTypes: { ANN: "Annexation", SPP: "Preliminary plat", SPF: "Final plat", MPC: "Master plan", CUP: "Conditional use permit", ZMA: "Rezone", ZTA: "Zoning text amendment", CTA: "Comprehensive plan text amendment", CMA: "Comprehensive plan map amendment", VAR: "Variance" }, citywideTypes: ["ZTA", "CTA"],
    caseVisuals: {
      ...Object.fromEntries(braeburnCreek.caseIds.map((id) => [id, {
        src: "/us/id/nampa/braeburn-concept-preview.webp", fullSizeUrl: "/us/id/nampa/toll-brothers-concept-plan.webp",
        alt: "Detail of the developer concept for Braeburn Creek showing proposed lots, streets and shared spaces",
        label: "Developer concept · March 13, 2026", note: "Detail crop. Early concept; later submissions may differ.",
        sourceUrl: "/us/id/nampa/toll-brothers-concept-plan.png", kind: "proposal",
      } satisfies MapVisual])),
      ...Object.fromEntries(Object.entries(CASE_EVIDENCE).flatMap(([id, evidence]) => {
        const visual = evidence.visuals?.[0]; if (!visual || !evidence.reportUrl) return [];
        return [[id, { src: visual.src, fullSizeUrl: visual.src, alt: visual.alt, label: visual.title + " · staff report", note: "Planning context, not a proposed site layout.", sourceUrl: evidence.reportUrl + "#page=" + visual.sourcePage, kind: "context" } satisfies MapVisual]];
      })),
    },
    loadCases: getNampaHearings, loadCaseReports: getNampaVisualReports, recordClient: nampa.energov,
    presentation: (hearing, plan) => ({ title: caseDisplayTitle(hearing, plan), summary: caseSummary(hearing, plan), href: areaPath(AREAS.nampa) + projectPathForCase(hearing.appId), hearing: getProjectForCase(hearing.appId)?.nextHearing }),
  },
  meridian:{area:AREAS.meridian,id:"meridian",name:"Meridian",mapOnHub:true,center:AREAS.meridian.center,zoom:11,bounds:[-116.58,43.46,-116.23,43.8],state:{abbreviation:"ID",fips:"16",name:"Idaho"},
    caseGeometry:{layers:AREAS.meridian.sources.geometry!,where:MERIDIAN_WHERE,caseIdField:"App_ID",fields:{type:"App_ID",phase:"Hearing_Type",status:"Action",title:"Name",link:"Weblink"},parcelFallback:{layerUrl:AREAS.meridian.sources.parcelFallback!,matchField:"PARCEL",recordField:"parcel",ignored:[]}},
    flum:{layerUrl:AREAS.meridian.sources.flum!,categoryField:"class2",colorSource:"renderer",planName:"Meridian Comprehensive Plan",label:"Meridian Comprehensive Plan, Future Land Use",adoptedDate:null,adoptionSource:"https://meridiancity.org/community-development/planning/comprehensive-plan/",dataNote:"Plan designation only. Listed zoning examples are not exhaustive; compatibility is not inferred from an unlisted district.",simplifyTolerance:0.00002},
    addressPoints:{layerUrl:"",addressField:"",where:"1=1",suffix:"Meridian, ID"},stages:{phase:{Review:"In review","City Council":"Council/Board","PZ Commission":"P&Z",Decided:"Decided"},status:{},recorded:{phases:[],statuses:[]}},caseTypes:MERIDIAN_TYPES,citywideTypes:[],isCitywide:h=>h.citywide===true,loadCases:getMeridianHearings,parseFeature:meridianFromFeature,stageForCase:h=>meridianStage(h) as import("./types").MapStage,presentation:h=>({title:meridianTitle(h),summary:meridianSummary(h),href:areaPath(AREAS.meridian)+"/plan/"+encodeURIComponent(h.appId)}),
  },
  "canyon-county": {
    area: AREAS["canyon-county"], id:"canyon-county", name:"Canyon County", mapOnHub:true, center:AREAS["canyon-county"].center, zoom:10, bounds:[-117.2,43.15,-116.3,44.0], state:{abbreviation:"ID",fips:"16",name:"Idaho"},
    caseGeometry:{layers:AREAS["canyon-county"].sources.geometry!,where:countyCaseWhere(),caseIdField:"PermitNum",fields:{type:"AppType",phase:"Status",status:"ApprovalStatus",title:"Description",parcel:"ACCOUNT"},parcelFallback:{layerUrl:AREAS["canyon-county"].sources.parcelFallback!,matchField:"ACCOUNT",recordField:"ACCOUNT",ignored:[]}},
    flum:{layerUrl:AREAS["canyon-county"].sources.flum!,categoryField:"FLU_ZONE_C",colorSource:"renderer",planName:"Canyon County 2030 Comprehensive Plan",label:"Canyon County 2030 adopted Future Land Use",adoptedDate:null,adoptionSource:"https://www.canyoncounty.id.gov/elected-officials/commissioners/development-services/dsd-gis/",dataNote:"Adopted Future Land Use layer. City plans and rural-residential overlays are separate; this designation alone does not establish zoning compatibility.",simplifyTolerance:0.00002},
    addressPoints:{layerUrl:"",addressField:"",where:"1=1",suffix:"ID"},
    stages:{phase:{Review:"In review",Board:"Council/Board","Hearing Examiner":"P&Z","PZ Commission":"P&Z",Decided:"Decided"},status:{Approved:"Decided",Denied:"Decided","In Progress":"In review"},recorded:{phases:[],statuses:[]}},
    caseTypes:COUNTY_TYPES,citywideTypes:[],isCitywide:h=>h.citywide===true,loadCases:getCanyonCountyHearings,parseFeature:countyFromFeature,
    stageForCase:hearing=>{const stage=countyStage(hearing);return stage==="Hearing Examiner"?"P&Z":stage as import("./types").MapStage;},
    presentation:hearing=>({title:countyTitle(hearing),summary:countySummary(hearing),href:areaPath(AREAS["canyon-county"])+"/plan/"+encodeURIComponent(hearing.appId)}),
  },
};
export function getJurisdiction(id: string): JurisdictionConfig | undefined { return Object.hasOwn(JURISDICTIONS, id) ? JURISDICTIONS[id] : undefined; }
