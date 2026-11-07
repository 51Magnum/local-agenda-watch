import type { MapCase } from "./types";

/** A generic missing-outcome label must not contradict an explicit official status. */
export function reconcileDecisionHistory<T extends {label:string}>(item: MapCase, history:T[]): (T | {label:string})[] {
  const outcome = item.recordStatus?.trim().match(/^(approved|denied|withdrawn)\b/i)?.[0];
  if (!outcome) return history;
  const label = outcome[0].toUpperCase()+outcome.slice(1).toLowerCase();
  const known = history.filter(row=>!/^(?:Decided|Decision recorded); outcome not specified/i.test(row.label));
  return known.some(row=>new RegExp("^"+label+"\\b","i").test(row.label))
    ? known : [...known,{label:label+" — official record"+(item.decisionDate?", "+item.decisionDate:"")}];
}
