# Project page pilot

Braeburn Creek uses the resident-focused layout first; individual case pages retain their existing layout until the pilot is reviewed. Reusable components live in app/components/project-overview.tsx, with sourced fact and timeline models in lib/project-overview.ts and lib/project-timeline.ts.

Proposal numbers use published staff-report evidence, with a source-checked editorial pilot fallback. Density is homes divided by total site acreage, rounded to one decimal. Future land use is read from the refreshed boundary/FLUM intersection cache, never inferred from requested zoning. Multiple categories are listed without a compatibility judgment.

P&Z conditions and speaker counts are optional extracted fields. Conditions require a P&Z decision letter or minutes; counts require minutes. These low-stakes fields can publish only after body, case-section, quote, value and independent-pass checks pass at >=90% confidence; otherwise they require review. Decisions and votes stay manually gated. Counts from a separate minutes document are joined only when case ID and hearing date match; the timeline retains both citations under one Sources control. Linked cases merge only when dates, outcomes, votes and counts agree.

The extraction schema version changes once to collect these new fields. Existing cached PDF text is retained; the upgraded extraction runs once per document version, then normal unchanged-document skipping resumes. No production extraction or deployment is triggered by editing the page.

The school item requires a district capacity comment; applicant statements about school capacity are insufficient. Unsupported optional items are hidden. Missing hearing dates and results remain explicit. The pilot uses a clean, deterministic proposal summary rather than displaying the raw city request or landowner names.

Northside Logistics Center (ANN-00369-2026) is the second pilot. Its zoning variant shows request, site acreage (retaining decimals for small sites), and requested zoning. Current jurisdiction, GIS-derived future land use, and applicant follow beneath. Its documented warehouse/manufacturing intent is described as future use, without invented building area, jobs or traffic counts. Residential, nonresidential and mixed-use fact variants share the same component; unavailable facts are omitted.
