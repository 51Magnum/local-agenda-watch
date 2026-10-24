# Canyon County initial coverage

Preview routes: `/us/id/canyon-county`, `/map`, `/meetings`, `/plan/{caseId}`. County coverage is enabled in the registry for the local build; publishing is a separate deployment.

## Public sources

- Cases/polygons: https://maps.canyonco.org/arcgisserver/rest/services/DSD/DSD_PLANNING_ZONING_APP_TRACKER/FeatureServer/0
- Case selection: active records, filings or decisions since January 1 of the previous year. Related calendar cases may be older. Deduplicate by PermitNum, preserving parcel fragments in the map geometry. Parcel ACRES is not asserted to be proposed project acreage.
- Hearing calendar: https://landhearingsagenda.canyoncounty.id.gov/Landing. Reads the public client's monthly and event-detail endpoints. Collects two prior months through three future months and follows explicit links to earlier hearings. This is a recent archive plus linked history, not a complete County archive.
- FLUM: adopted 2030 layer 1, category FLU_ZONE_C, renderer colors. Rural-residential overlays and city FLUMs remain separate. No zoning-compatibility assertion without a verified mapping.
- County boundary: Census; incorporated city limits: General/CITY_LIMITS_PUBLIC/FeatureServer/0. Coverage search and the homepage map use the County boundary minus incorporated places. County-owned historical cases remain visible even if subsequently annexed. Nampa coverage takes precedence where it overlaps.

City-limit subtraction asset checked October 23, 2026. Refresh after annexations with `npx tsx scripts/refresh-county-coverage.ts`; review the resulting diff and rerun coverage tests.

## Refresh and storage

`getCanyonCountyHearings` caches for one hour. The existing scheduled map refresh starts jurisdictions independently, so one area's slow document requests do not prevent another area's refresh. County source snapshots persist in Neon `law_source_cache` (area key `canyon-county`) or ignored local `.data/canyon-county-feed.json`. Map snapshots use existing `law_map_cache`; FLUM is refreshed weekly. The migration uses CREATE TABLE IF NOT EXISTS and requires no credentials in code.

GIS and calendar failures are independent. Keep prior events and case records, log source failures, and show an unavailable notice. Calendar challenge pages, unexpected markup, and HTTP failures are not empty successes. Case pages link to actual `/Landing?eventId=` pages and `/DownloadDocument/` URLs; do not construct Nampa EnerGov links.

## Meaning of stages and dates

Keep P&Z, Hearing Examiner, and Board authorities distinct. A recommendation alone does not establish approval. Prefer the next published appearance for the current stage; an elapsed hearing without a result remains pending. Case-specific comment deadlines are copied exactly. A date without a time stays date-only; never apply Nampa's noon rule. Calendar files use the published hearing time with America/Denver daylight-saving conversion. No hearing location is invented when the event omits it.

Countywide ordinance entries have a different HTML schema. An OR-prefixed identifier by itself is not countywide: some are site-specific plan amendments paired with rezones. Only the County's Ordinance Updates entries establish countywide treatment.

## Acceptance samples and limits

- SD2025-0002, Pheasant Heights: filed January 29, 2025; August 20, 2026 P&Z Recommended Approval; October 29 Board hearing at 1:30 PM MDT; published comment deadline October 19. Board staff report 1467 and P&Z findings 1341 are linked separately.
- SD2026-0001, Tillman Ridge: October 22 Hearing Examiner event has Pending action; do not infer an outcome.
- OR2025-0019, Land Division Ordinance Amendment: November 5 P&Z, countywide with no parcel pin.
- CR2025-0018 / OR2025-0027: paired site-specific applications, not countywide.

This first adapter presents structured County case descriptions, timelines, official outcomes, and original documents. It does not yet run County PDFs through the AI/OCR review queue or extract proposal thumbnails. Existing review rules remain intact. Some County reports exceed the current 45 MB intake limit (Pheasant Heights Board report approximately 64 MB); a background large-document path is required before promising the same reviewed staff-report facts/images as Braeburn Creek. Original official downloads work independently of that limit. Do not label structured GIS descriptions as staff-report summaries.
