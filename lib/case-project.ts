import type { Hearing } from "./localities/types";
import type { EnerGovPlan, EnerGovAttachment } from "./sources/energov";
import { caseDisplayTitle, caseProjectName, cleanCaseType, displayTitle } from "./case-details";
import { CASE_EVIDENCE } from "./case-evidence";
import { projectOverview, sourcedField, type ProjectOverview } from "./project-overview";
import { latestField, type TimelineData } from "./timeline/public";

/** A short, explicit project name in a city record can link related application types. */
export function caseGroupingName(hearing: Hearing, plan: EnerGovPlan | null = null): string | undefined {
  const name = caseProjectName(hearing, plan);
  if (name) return name;
  const scope = displayTitle(hearing.appScope ?? "");
  return scope && scope.length <= 90 && caseDisplayTitle(hearing, plan).startsWith(scope + " ") ? scope : undefined;
}
/** Structured city fields are fallbacks; do not turn narrative/legal descriptions into public prose. */
export function caseLocation(hearing: Hearing, plan: EnerGovPlan | null): string | undefined {
  if (plan?.MainParcelNumber === "R1542600000") return undefined;
  const street = (hearing.description ?? "").match(/\bat\s+([1-9]\d{0,5}\s+(?:[NSEW]\.?\s+)?[\w .'-]{2,70}?\b(?:Road|Rd|Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b)/i)?.[1];
  const address = plan?.MainAddress ?? CASE_EVIDENCE[hearing.appId]?.address ?? street;
  return address?.replace(/\r?\n/g, ", ").replace(/\s+/g, " ").trim() || undefined;
}
export function safeProposalSummary(value?: string): string | undefined {
  return value && !/\b(?:parcel|township|landowner|property owner|section\s+\d|T\d+N|R\d+W|R\d{7,})\b/i.test(value) ? value : undefined;
}
export function caseProjectOverview(hearing: Hearing, plan: EnerGovPlan | null, attachments: EnerGovAttachment[], data: TimelineData, sourceUrl: string, citywide: boolean): ProjectOverview {
  const requestLabels: Record<string,string> = {ANN:"Annexation",ZMA:"Rezoning",SPP:"Preliminary plat",SPF:"Final plat",MPC:"Master plan",CUP:"Conditional use permit",VAR:"Variance",ZTA:"Zoning text amendment",CTA:"Comprehensive plan text amendment",CMA:"Comprehensive plan map amendment"};
  const type = requestLabels[hearing.appType] ?? cleanCaseType(plan?.PlanType || hearing.appTypeLabel);
  const context = [hearing.appScope, hearing.description, plan?.Description].filter(Boolean).join(" ");
  const zoning = context.match(/\bto\s+(IL|IH|RA|RS\d+|RML|RMH|BC|GB\d?)\b/i)?.[1]?.toUpperCase();
  const overview = projectOverview(data, {
    variant: "zoning", request: { value: type, url: sourceUrl },
    ...(!citywide && hearing.appAcres != null && hearing.appAcres > 0 ? { acres: { value: String(hearing.appAcres), url: sourceUrl } } : {}),
    ...(zoning ? { zoning: { value: zoning === "IL" ? "IL (light industrial)" : zoning, url: sourceUrl } } : {}),
  });
  const units = latestField(data.fields.filter(f => f.sourceKind === "staff-report"), "units");
  // A plat can divide commercial land. Lots alone are not evidence of homes.
  const residential = /\b(?:single.family|residential|homes|dwellings?|apartments?)\b/i.test(context + " " + (units?.quote ?? ""));
  const industrial = /\b(?:industrial|warehouse|manufacturing|commercial|retail)\b/i.test(context) || /^(?:IL|IH|BC|GB)/.test(overview.zoning?.value ?? "");
  if (citywide) { overview.homes = undefined; overview.acres = undefined; overview.zoning = undefined; }
  else if (units && residential) overview.variant = "residential";
  else if (units && /plat|subdivision/i.test(type)) overview.variant = "subdivision";
  else { overview.homes = undefined; if (industrial) overview.variant = "nonresidential"; }
  const title = caseDisplayTitle(hearing, plan, attachments);
  const location = !citywide && caseLocation(hearing, plan);
  const requests: Record<string,string> = {
    ANN: "The application requests annexation, bringing the site into city limits.",
    ZMA: "The application requests a change to the site's zoning rules.",
    SPP: "The application proposes a preliminary layout of subdivision lots and streets.",
    SPF: "The application requests approval of a final subdivision plat.",
    MPC: "The application proposes a master planned community.",
    CUP: "The application requests a conditional use permit for a use subject to city review.",
    VAR: "The application requests a variance from a land-use requirement.",
    ZTA: "The application proposes changes to the city's zoning code.",
    CTA: "The application proposes changes to the comprehensive plan text.",
    CMA: "The application proposes changes to the comprehensive plan map.",
  };
  const fallback = (requests[hearing.appType] ?? title + ".") + (overview.acres ? " The request covers " + overview.acres.value + " acres" + (location ? " at " + location.replace(/[.,\s]+$/, "") : "") + "." : location ? " The site is at " + location.replace(/[.,\s]+$/, "") + "." : "") + (overview.zoning ? " Requested zoning: " + overview.zoning.value + "." : "");
  const reportSummary = latestField(data.fields.filter(f => f.sourceKind === "staff-report"), "requestSummary");
  overview.summary = safeProposalSummary(reportSummary?.value) ?? fallback;
  overview.summarySource = safeProposalSummary(reportSummary?.value) ? sourcedField(reportSummary) : { value: fallback, url: sourceUrl };
  return overview;
}
