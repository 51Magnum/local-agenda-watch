# Jurisdiction onboarding: current state

Audit: 2026-10-27, before onboarding refactor. Baseline: origin/main e523a3fd9aa80a1c04eb29f5533998d904f6f78a.

## Existing sources and rendering

| Area | Applications | Agenda/record collection |
| --- | --- | --- |
| Nampa | ArcGIS + EnerGov | PrimeGov public portal, compiled documents; city hearing notices |
| Meridian | ArcGIS development layer | Municipal clerk notices, Laserfiche records and Municode meeting archive |
| Canyon County | ArcGIS planning tracker | Dedicated land-hearings calendar and case event pages |
| Kuna | ArcGIS public hearing tracker | CivicPlus Archive agenda/packet/minutes feeds, linked SharePoint libraries |
| Eagle | ArcGIS active applications | Granicus ViewPublisher agenda links |
| Star | Agenda-based inventory | Municode PublishPage; verified parcel fallback |
| Middleton | Published notice inventory | Public Sanity page-content API and linked PDFs |

These sources have different completeness guarantees. A hearing is not a decision. Preserve existing parser behavior, source attribution, pagination, caching, privacy rules and saved data.

The continuous map uses lib/maps/refresh.ts, case-index.ts, radius.ts, viewport.ts and coverage layers. ProjectPane supplies the six questions on map and standalone project views. Public routes, location search and the sitemap currently derive primarily from AREAS.status=live. That flag combines ingestion eligibility with publication; staging must split these concerns. Canonical routes are /us/id/<area>.

## Definition and list duplication

- lib/areas/registry.ts: identity, bodies, sources, boundaries and participation; nampa/meridian/canyon inline entries.
- lib/areas/idaho-cities.ts and lib/sources/municipal-config.ts: four additional city definitions and source settings.
- lib/maps/jurisdictions.ts: per-source geometry, stages, parsing, record and feed functions.
- lib/localities/index.ts: three named feed imports plus municipal feed map.
- lib/localities/municipal.ts: source-specific parsing branches, archive IDs and feed caching.
- lib/areas/server.ts and municipal-pages.tsx: page adapter registration.
- lib/areas/coverage-style.ts: six named city colors; county fallback.
- lib/hearings/policies.ts, refresh.ts and resolver.ts: verified Nampa participation and PrimeGov meeting matching.
- lib/timeline/discover-areas.ts: source-specific document-discovery branches and official host allowlists.
- .github/workflows/project-content.yml: explicit seven-area loop.
- scripts/prepare-boundaries.ts, refresh-county-coverage.ts, prepare-flum-tiles.ts: boundary and tile setup assumptions.
- lib/maps/case-index.ts, radius.ts, image-worker.ts, project-content-worker.ts, timeline/schedule.ts, email/jobs.ts: derive many lists from live areas, but must distinguish publication from ingestion.
- app/sitemap.ts: includes an area URL even before its live check; staging entries must never enter this list.
- app/api/map/project and maps APIs: public access must continue to reject unpublished cases.
- Tests contain fixed seven-area and uncovered-Boise expectations; update only eligibility expectations and preserve existing outputs.

Historical case-specific overrides and jurisdiction-specific official rules are facts, not jurisdiction inventories; do not remove them merely because they mention a city.

## Storage, jobs, AI and email

Neon tables are created lazily by the existing stores (timeline documents/pages/fields/runs, map cases, feed snapshots, image queue, project content, subscriptions/delivery queue and AI daily reservations). Existing migrations include hearing meetings. New onboarding tables will use versioned, reversible SQL and isolate QA data by jurisdiction and run. No DB jurisdiction enum needs changing.

AI: lib/timeline/extract.ts calls structured Responses, lib/ai-budget.ts atomically reserves daily dollars, telemetry attributes usage to document/area, ingest.ts hashes documents and enforces three-failure retry handling. Sensitive decisions/votes/testimony are verified/reviewed before publication. New per-area monthly/backfill/sample reservations must wrap the same call path, retaining the global daily cap. Budget exhaustion defers AI and must not stop hard-fact collection.

Sources already have caching and block telemetry, library traversal, native PDF extraction/OCR and provenance. Reuse them. Never send full meeting packets to AI; enforce attachment byte/token limits before download/extraction. Preserve nested final-agency-report discovery and image review.

Email was owner-enabled on 2026-10-27. Only public jurisdictions may enter subscriptions, digests, reminders or coverage announcements. Do not globally pause approved email while onboarding.

## Refactor boundary

1. One typed jurisdiction file controls identity, platform parameters, eligibility, color, source hosts, participation, geometry and budgets. Generate the import manifest automatically at build/CLI startup so another supported-platform entry requires one config file.
2. Reuse legacy feed and record functions behind platform interfaces, verified against fixtures and baseline tests; avoid rewriting working seven-area collectors.
3. New eSCRIBE, iQM2 and AdaFileBrowse platform adapters use shared bounded HTTP and ArcGIS paging. Transition dates are per body, not one global Boise cutoff.
4. Keep private onboarding state and admin rendering separate from public caches. Publication requires both passing QA and persisted admin approval.
5. Derive scheduling/map/filter/sitemap/email inventories from registry eligibility. Keep AI budget enforcement in the shared pipeline, not only the CLI.

## Source verification

The attached brief supplies candidate endpoints and rules, not proof of runtime accessibility. Record actual checks and dates. Do not bypass auth, CAPTCHA or Cloudflare. Validate Boise eSCRIBE downloads both locally and on the Git-sourced Vercel runtime. Unverified rules (including Ada close-of-business time) must stay qualified rather than becoming invented timestamps.
