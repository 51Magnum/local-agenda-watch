# Onboarding implementation log

## 2026-10-28 PR #7 fixes: inspection and plan

Base inspected: b694810, codex/ada-site-review. No merge, publication change or promotion is authorized. Recorded fixtures only in CI. Findings below were checked against the current implementation before source edits.

| Item | Inspection | Planned change and affected files |
| --- | --- | --- |
| A1+A2 | Confirmed: identical-ID grouping and exact matching miss suffix combinations. Date retention already keeps matched older applications, but matching is insufficient. | Configured project key and suffix-aware grouping/matching before date filtering; adapters/arcgis.ts, matching.ts, collect.ts, resident-records.ts, registry/ada-county.json; regressions for combined IDs and older heard cases. |
| A3 | Confirmed: no hearing-suffix scope; residential text heuristics miss individual staff permits. | Configured hearing suffixes, individual detector and privacy-safe resident projections; collect.ts, resident-records.ts, resident-project.ts, residential-privacy.ts. |
| A4 | Confirmed: filename items and greedy suffix capture; PDF extraction adds bare IDs only. | Parse actual agenda sections/time, normalize document case prefixes and human labels; adapters/ada-file-browse.ts, adapters/types.ts, recorded fixtures. |
| A5 | Confirmed: full descriptions pass through title/prose cleaners. | Deterministic bounded title; preserve official body text, including contradictory type wording; resident-records.ts, preview.ts. |
| A6 | Confirmed: signup fallback exists without a confirmed hearing. | Dated no-hearing state with official hearings/notices links; confirmed-only signup/deadlines; preview.ts and shared question rendering. |
| A7 | Confirmed: generic tracker and bare layer source. | Configured case-specific query template and public-link regression; adapters/arcgis.ts, registry/ada-county.json. Verify official endpoint independently. |
| A8 | Confirmed in code: cron/admin writes and runtime DDL lack environment guards. Actual deployed connection isolation remains unverified. | Production-only mutation guard, preview read connection and no read-triggered DDL; cron/admin routes, staging/map/index/privacy stores; audit other runtime stores. Document separate Neon preview DSN and operational verification. |
| A9 | Confirmed: robots allows crawling and root metadata uses production origin. | Nonproduction robots/metadata/header; suppress private production canonicals; app/robots.ts, layout.tsx, proxy.ts, area/project metadata. Read installed Next metadata docs before edits. |
| H1 | Confirmed: packet rejection follows evidence invalidation, applies to legacy packets and deferrals lack retry backoff. | Early onboarding-only block, durable deferral timestamp and retry guard; timeline/ingest.ts and regression fixtures. |
| H2 | Confirmed: hourly collection, shared document lease and whole-snapshot hash. | Twice-daily schedule, separate metadata work, canonical reviewed-content hash without operational fields; ingestion workflow, cron/jurisdictions, store.ts. Preserve QA plus recorded approval checks. |
| H3 | Confirmed: two triggers and normal scheduler skips return 409. | Multiple DST-safe window triggers, successful status responses/logging for ordinary skips; workflow and cron/case-timeline tests. |
| M1 | Confirmed: client area registry imports full definitions and static private boundaries. | Generate public-only client metadata, isolate server definitions and serve boundary data server/API-side; generator, area/jurisdiction registries and affected imports; CI static-bundle scan. Existing review mode must not become a publication bypass. |
| M2 | Confirmed: fetch errors/non-OK leave both AI reservations open; no stale reconciliation. | Finally-based release plus transactional stale reconciliation; timeline/extract.ts, ai-budget.ts, jurisdictions/ai-budget.ts. |
| M3 | Confirmed: legacy areas receive the unmeasured per-area caps. | Exempt legacy public areas from area caps until measured, retaining global/sample limits; jurisdictions/ai-budget.ts. |
| M4 | Confirmed: file_data uses a million-token bound; reports above byte cap cannot enter sample candidates. | Physically bounded page-image OCR, realistic token bound and bounded large-report native extraction with explicit deferred remainder; extract.ts, pdf-sample.ts, onboarding.ts, attachment policy. |
| M5 | Partly incorrect: geometryMatchRate already supplies the geometry-rate row. The no-location label conflates dimensions. | Keep correct geometry rate; separately count applications without geometry/address and agenda items lacking location; onboarding.ts, report.ts, mixed fixture test. |
| M6 | Confirmed: intersects-only county filter and no configurable application geometry join. | Majority-area/point coverage eligibility with unverified missing geometry; generic join/address fallback configuration and recorded tests; collect.ts, adapters/arcgis.ts, Boise registry. Verify exact address service before configuring. |
| L1 | Confirmed hard-coded actor; authorizedReviewer currently allows only admin. | Derive authenticated actor without broadening auth policy; auth.ts and two approval routes. |
| L2 | Confirmed: runtime CREATE TABLE omits migration constraints. | Remove onboarding runtime DDL; migration remains source of truth; add reversible constraint repair if deployed schema needs it. |
| L3 | Confirmed: broad non-decision auto-publication can publish applicantCompany despite prompt instructions. | Gate individual applicant values in verification, ingest and public projection; require manual review. |
| L5 | Confirmed: oversized eSCRIBE fixture and tracked QA sample field values. | Trim irrelevant ViewState with provenance note; redact private-name candidates in future reports and replace/remove unsafe old reports; fixtures, report.ts, onboarding.ts, reports/jurisdictions. |
| L6 | Partly implemented: qaReport already excludes past meetings; duplicates are not removed. | Deduplicate body/date (prefer confirmed over tentative) before limiting upcoming hearings; onboarding.ts with regression. |
| C | Pending all preceding checks. | Dry-run collection first; isolated staging only; redacted counts/costs and ADA_LAUNCH_CHECKLIST.md. Owner alone approves and promotes through existing gates. |

Each focused implementation commit will record its validation and remaining limitations below. No production writes or preview backfill will be attempted before the environment protections are in place.

A1+A2 implementation: grouping is declared by projectKey in the Ada registry, preserves source suffix aliases, unions parcels and polygons, and matches combined agenda identifiers by project number plus compatible suffix sets. Matching now happens after grouping and before the existing hearing-linked retention rule; combined agenda aliases are retained for resident links/history. Nine focused regressions pass and TypeScript passes. Fresh live backfill/counts and the eight missing heard records remain to verify after agenda parsing and preview isolation; these are not yet claimed complete.

Branch: codex/jurisdiction-onboarding. User brief: attached 2026-10-27-jurisdiction-onboarding-boise-ada.md.txt.

Scope: reusable registry/platform onboarding first; Boise and Ada admin-only second. Never publish either. Keep live email approval intact.

Completed: initial audit; generated, validated nine-file registry; platform adapters and compatibility bridges; bounded cached HTTP; private staging and promotion approval; deadline engine; transactionally enforced AI budgets; CLI; protected admin map/project previews and image controls; reversible migrations; source fixtures and regression tests.

Validation: 541 tests in 104 files pass, including unchanged seven-area manifests, the legacy source client, existing public-page tests, recorded source contracts, nested agency library discovery, promotion approval, document-hash deduplication, bounded page-image OCR, packet exclusion and atomic multi-bucket budgets. Typecheck and Git-built Vercel previews pass. Full lint passes with four existing unused-variable warnings; existing internal-link errors in four admin pages and an unescaped apostrophe on Contact were corrected without changing their content.

Source collection: Boise 267 active applications, 45 meetings, 103 case items; Ada 110 recent or hearing-linked PZ applications, six meetings, 92 case references. Initial bounded collections completed; the latest Boise refresh retained deferred meeting work for the next run. Ada tentative dates remain separate from confirmed agendas. Oversized reports and compiled packets are excluded. Boise has no application geometry or received date in the active table; neither is invented. Ada county geometry excludes incorporated cities. Older hearing-linked active records are retained, with unambiguous parcel/address fallback matching. Historical cases missing from the active source remain unmatched; a targeted historical-record lookup is not implemented.

Runtime results: eSCRIBE per-item PDFs return Cloudflare HTTP 403 from both local ingestion and the Git-built Vercel preview. No bypass was attempted. Boise iQM2 and Ada PDFs download successfully. Each jurisdiction has five existing-pipeline AI samples. Measured spend: Boise $0.0494172, Ada $0.0282872. Boise also retains $0.0055752 reserved for uncertain failed image calls. Every sample invocation stayed below $1. Remaining report appendices are explicitly deferred. Records and images preserve official source links and physical pages.

Ten sampled private project pages render the six questions, As-of stamps, reporting links, official sources and image/context fallbacks. Public Boise/Ada pages return 404 and their URLs are absent from the sitemap. Map visual review remains an explicit checklist, not a claimed screenshot review.

Delivery: PR #6, https://github.com/51Magnum/local-agenda-watch/pull/6. QA Markdown and JSON are in reports/jurisdictions. Boise and Ada remain admin_only; neither has an admin publication approval. Nothing was merged to main or deployed to production. Only Git-built previews were used. Production-runtime source access is not verified. Council's configured transition date is 2027-01-12; HPC's exact transition remains unverified.

The preview uses branch-scoped admin credentials saved only in ignored output/jurisdictions/preview-credentials.json in the owner's workspace (username admin, REVIEW_ADMIN_PASSWORD entry). Production credentials and enabled email delivery were not changed.
