import { CASE_EVIDENCE } from "./case-evidence";
import type { ProjectOverview } from "./project-overview";
export const NORTHSIDE_ID="ANN-00369-2026";
export const NORTHSIDE_REPORT=CASE_EVIDENCE[NORTHSIDE_ID].reportUrl!;
// Editorial pilot: physical pages of the official September 29 staff-report packet.
// No inferred building size, jobs, truck counts, or operating hours.
export const northsideOverview:ProjectOverview={
  variant:"zoning",
  request:{value:"Annexation & zoning",url:NORTHSIDE_REPORT,page:1},
  acres:{value:"1.69",url:NORTHSIDE_REPORT,page:12},
  zoning:{value:"IL (Light Industrial)",url:NORTHSIDE_REPORT,page:1},
  currentJurisdiction:{value:"Canyon County",url:NORTHSIDE_REPORT,page:1},
  applicant:{value:"Ardurra, for Nampa Logistics Center LLC",url:NORTHSIDE_REPORT,page:1},
  summarySource:{value:"Staff report",url:NORTHSIDE_REPORT,page:1},
  traffic:{value:"Traffic-study requirements will be assessed when future development is proposed; the city requires a study above 100 new peak-hour trips or 1,000 new daily trips.",url:NORTHSIDE_REPORT,page:1},
};
