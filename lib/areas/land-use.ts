import {titleCase} from "@/lib/resident-copy";
import { areaPath, type AreaDefinition } from "./registry";
import type { SourcedFact } from "../project-overview";

export type LandUseFact = SourcedFact & { mapHref: string; comparisonSourceUrl?: string };

/** A district comparison only, not a finding that every plan policy is satisfied. */
export function landUseFact(area: AreaDefinition, categories: string[], zoning?: string, caseId?:string): LandUseFact | undefined {
  const unique = [...new Set(categories.filter(Boolean))];
  if (!unique.length || !area.sources.flum) return undefined;
  const fact: LandUseFact = {
    value: (unique.length > 1 ? "Mixed: " : "") + unique.map(titleCase).join("; "),
    url: areaPath(area) + "/map?flum=1"+(caseId?"&case="+encodeURIComponent(caseId):""),
    mapHref: areaPath(area) + "/map?flum=1"+(caseId?"&case="+encodeURIComponent(caseId):""),
  };
  // Multiple designations need the proposed zoning layout to make a comparison.
  if (unique.length !== 1 || !zoning || !area.flumCompatibility) return fact;
  const mapping = Object.entries(area.flumCompatibility.categories).find(([category]) => category.toLowerCase() === unique[0].toLowerCase())?.[1];
  if (!mapping) return fact;
  const districts = [...new Set((zoning.match(new RegExp(area.flumCompatibility.zoningCodePattern, "gi")) ?? []).map(code => code.replace(/\s/g, "").toUpperCase()))];
  if (!districts.length) return fact;
  const consistent = districts.every(code => mapping.districts.includes(code));
  fact.value += consistent ? ", consistent with requested " + districts.join(" / ") + " zoning" : ", differs from plan (requested " + districts.join(" / ") + " zoning)";
  fact.comparisonSourceUrl = mapping.sourceUrl;
  return fact;
}
