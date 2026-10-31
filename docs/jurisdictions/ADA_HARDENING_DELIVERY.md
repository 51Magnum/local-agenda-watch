# Ada fixes and onboarding hardening delivery

Implementation is on `codex/ada-site-review`, PR #7. No merge, production deployment, owner approval or public promotion was performed. Ada County and Boise remain `admin_only`.

## 1. Item status and implementation commits

“Done” means implemented and regression-tested. Environment/manual checks that remain are listed below; it does not mean launch-approved.

| Item | Status | Commits |
| --- | --- | --- |
| A1+A2 | Done; all eight older heard projects verified in fresh dry-run | 44735ae, 3953aa2, eb38d7e |
| A3 | Done; hearing scope, private staff and residential-use projections | 7d72134, b0590b8, 42598fb, 4eb251f |
| A4 | Done; actual agenda sections/time, human document labels, physical pages | a2291bd, c57d367 |
| A5 | Done; concrete short titles and verbatim descriptions | c002077, fd8d4d3, 402956c |
| A6 | Done; confirmed-only participation and dated no-hearing state | ea3bcfd |
| A7 | Done; official case-specific/source queries | 4f1e41e, a00634f |
| A9 | Done; nonproduction noindex and preview canonicals | 05d11b9 |
| H1 | Done; legacy case-page OCR/extraction, early deferral/backoff | 700ff50, ab2c184, bb508fc |
| H2 | Done; stable QA hash, twice-daily metadata, separate work | 595b6d5, e36dfff, 41767a4 |
| H3 | Done; DST-safe retries and successful scheduler no-ops | 6634dbe |
| M1 | Done; public-only client metadata and build-enforced bundle scan | 00bd7cf, 0051fbf |
| M2 | Done; both AI reservations cleaned up, stale holds reconciled | 4f25a86 |
| M3 | Done; legacy per-area dollar caps exempt until measured | 4e0e33b |
| M4 | Done in code/tests; large-report Vercel execution unverified | 514e299, bb508fc |
| M5 | Done; alleged geometry-rate input swap skipped because already correct; counts separated | 77526bd |
| M6 | Done; coverage rule and verified configured geometry/address joins | 62c3ded, eb38d7e, 0b877ee, 4eb251f, 41767a4 |
| L1 | Done; authenticated approval actor, same auth policy | f7d3772 |
| L2 | Done; migration-owned schema and reversible constraint repair | 8efceb8, 94e12c1 |
| L3 | Done; private/uncertain applicant candidates require review | 92f6371, 42598fb |
| L5 | Done; trimmed fixture and redacted past/future distributed QA | 73405ae |
| L6 | Done; deduplication; past-date exclusion was already present | 008fce7 |
| C | Partial: fresh read-only QA and checklist prepared; staging/AI/runtime/owner approval pending | 0df4311, aeb2945, 41767a4 |

The brief contains no L4 item. CLI public-list parsing is also covered by bf61d46.

## 2. Files changed, grouped by item

Tests are alongside each corresponding module; recorded fixtures and their provenance are under `lib/jurisdictions/fixtures/`.

- **A1+A2:** `lib/jurisdictions/application-groups.ts`, `matching.ts`, `collection-window.ts`, `collect.ts`, `resident-records.ts`, `adapters/types.ts`, `registry/ada-county.json`, and their regression tests.
- **A3:** `application-scope.ts`, `resident-records.ts`, `preview.ts`, `lib/applicant-privacy.ts`, `lib/maps/refresh.ts`, scope/privacy/configured-snapshot tests. The existing resident-project and residential privacy helpers are reused.
- **A4:** `adapters/ada-file-browse.ts`, new `adapters/ada-agenda.ts`, `adapters/types.ts`, `preview.ts`, recorded PZC/BOCC text and provenance, agenda/page-source tests.
- **A5:** `application-copy.ts`, `adapters/arcgis.ts`, `resident-records.ts`, `preview.ts`, five recorded descriptions, title snapshots and ingestion regression.
- **A6:** `hearing-state.ts`, `types.ts`, Ada registry participation URLs, `preview.ts`, `lib/maps/project-questions.ts`, `app/components/maps/project-pane.tsx`, hearing-state tests.
- **A7:** `application-source.ts`, `official-gis-link.ts`, `adapters/arcgis.ts`, `preview.ts`, `runtime.ts`, `lib/areas/registry.ts`, source-link tests.
- **A9:** `app/robots.ts`, `app/layout.tsx`, `proxy.ts`, `lib/environment-metadata.ts`, `project-seo.ts`, `areas/server.ts`, metadata tests.
- **H1:** `lib/timeline/ingest.ts`, `types.ts`, `store.ts`, `report-pages.ts`, packet/retry regressions.
- **H2:** `.github/workflows/jurisdiction-ingestion.yml`, cron/admin jurisdiction routes, `snapshot-hash.ts`, `store.ts`, hash/promotion/identity tests.
- **H3:** `.github/workflows/case-timeline.yml`, timeline cron route and route/DST trigger tests.
- **M1:** `scripts/generate-jurisdictions.mjs`, server-only `generated.ts`/registry, `generated-public.ts`, `lib/areas/public-registry.ts`, `coverage-client.ts`, public presentation imports/helpers and location/map components, `/api/map/coverage`, `scripts/check-client-bundle.mjs` and tests, server CLI entrypoints, package files, Vitest test-only server resolver, verify/map/flum workflows.
- **M2:** `lib/timeline/extract.ts`, both budget ledgers, `lib/timeline/budget-cleanup.test.ts`.
- **M3:** `lib/jurisdictions/ai-budget.ts`, legacy-budget tests, onboarding admin policy text.
- **M4:** `native-sample.ts`, `onboarding.ts`, `collect.ts`, document types/validation, Ada/Boise native byte limits, `lib/ai-budget.ts`, timeline extraction/ingestion and OCR/native-limit tests.
- **M5:** `location-metrics.ts`, `onboarding.ts`, `report.ts`, mixed metrics test.
- **Boundary follow-up (M6/H2):** `boundary-source.ts`, identity/projection/hash regressions, Ada registry and both boundary caches, `fixtures/ada-boundary-provenance.json`, collection/read projection and QA/hash gates (41767a4). Official selection is exactly one `county_name='Ada'` feature; the former seven-county cache is rejected.
- **M6:** `application-geolocation.ts`, `adapters/arcgis.ts`, `collect.ts`, Boise join/fallback configuration, `resident-records.ts`, `preview.ts`, `lib/maps/refresh.ts`, recorded polygon/civic-address fixtures and provenance, geolocation/configured-map tests.
- **L1:** `lib/timeline/auth.ts`, both jurisdiction approval handlers, reviewer identity tests.
- **L2:** `lib/jurisdictions/store.ts`, the up/down repair migration and migration test.
- **L3:** `lib/applicant-privacy.ts`, `application-scope.ts`, timeline `types.ts`, `verification.ts`, `ingest.ts`, applicant review tests.
- **L5:** `report-privacy.ts`, report/onboarding generators, trimmed eSCRIBE fixture/provenance, four October 27 report artifacts, redaction tests.
- **L6:** `next-hearings.ts`, `onboarding.ts`, upcoming-hearing regression.
- **C:** `qa-builder.ts`, `launch-metrics.ts`, `report.ts`, CLI/report tests and entrypoint, October 28 dry-run JSON/Markdown, this delivery record, `ADA_LAUNCH_CHECKLIST.md`, `WORK_LOG.md`.

## 3. Migrations

- `migrations/20261028_onboarding_constraints.up.sql`: adds/validates named launch-status, nonempty reviewer and nonnegative spent/reserved CHECK constraints missing from old runtime-created tables. Idempotent and data-preserving.
- `migrations/20261028_onboarding_constraints.down.sql`: removes only those repair constraints; retains data and pre-existing constraints.


## 4. Environment

| Name | Purpose/scope | Example, no credential |
| --- | --- | --- |
| `VERCEL_ENV` | Existing system variable; mutations allowed only for `production`; preview/development/default refuse. | `preview` / `production` |
| `VERCEL_BRANCH_URL`, `VERCEL_URL` | Existing system URLs used for preview canonical origin. | `branch-review.example.vercel.app` |
| `LAW_SITE_REVIEW_AREAS` | Existing branch-scoped review selection; retained, server-only, never emitted into client metadata. | `ada-county` on the review branch only |

No secret value was committed. Production delivery approval and preview delivery-off behavior are preserved.

## 5. Verification

- 682 tests in 139 files pass, including recorded fixtures, legacy manifests, mutation refusals, budget failures, privacy and source provenance.
- TypeScript passes. ESLint has zero errors and four pre-existing unused-variable warnings.
- Final Next build passes. Its scan reports: `Client bundle isolation PASS: 41 static files; no private jurisdiction IDs, source hosts, cost caps or Ada boundary content.`
- Corrected Ada bounds: west -116.513727, south 43.112645, east -115.974901, north 43.807428. Official source identity/count and city clipping are verified; old staging is filtered against this cache.
- Official Ada case query HTML returned 403; verified pjson/json/geojson formats returned 200. The app uses the verified project-specific pjson source.
- Boise live read-only check: 257 applications, 154 polygons, 93 unique address points, 10 unmapped, zero deferred source failures. The named address service in the brief is invalid; the verified organization service is `Address_Points/FeatureServer/21`.
- No paid AI call, staging write, production cron invocation, migration application or promotion was performed in this task.

## 6. Ada before/after

| Measure | Earlier review | Fresh scoped dry-run |
| --- | ---: | ---: |
| Distinct APPFILE/project records | 99 | 34 |
| Project numbers duplicated | 15 (18 extra records) | 0 |
| Projects with linked hearing history | 3 | 23 |
| Privacy-detected/protected retained projects | 3 | 1 |
| Projects before hearing scope | 81 distinct baseline project numbers | 87 current projects |
| Staff records excluded by current scope | No such filter | 53 |
| Reviewed missing heard projects with history | Missing/incomplete in the review | 8/8 found |

Six of 41 hearing items remain unmatched to retained application records; their official agendas remain the source. Matching is 35/41 (85.4%). A complete bounded collection does not claim complete historic records. The lower retained privacy count reflects scope exclusions, not less protection.

Fresh-run AI spend is zero and its durable budget ledger was not read. Five historical October 27 Ada samples have measured spend $0.0282872; source hashes must be current before reuse. The fresh dry-run deliberately fails launch readiness for missing current AI/runtime/staged-QA prerequisites.

## 7. Automatic onboarding supersedes the former manual launch ritual

The sections above record historical October 28 evidence. Current work uses the self-check gate and exception queue in [ADA_LAUNCH_CHECKLIST.md](ADA_LAUNCH_CHECKLIST.md). Current results are in the dated self-check report; historical counts and raw-data links are not current validation.


Preview onboarding uses committed, redacted snapshots. See [Adding a jurisdiction](ADDING_A_JURISDICTION.md); no separate infrastructure is required.
