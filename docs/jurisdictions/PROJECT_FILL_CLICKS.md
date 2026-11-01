# Whole-polygon project clicks — October 31, 2026

## Confirmed cause

The failure was reproduced on the pre-fix snapshot, with every click hit and ID lookup logged. Ada `202600638-ZC` contained four identical parcel polygons. Its centroid returned no `law-fill` hits at zooms 13 and 15. Clicking its edge returned `law-outline`, ID `ada-county:202600638-ZC`, which resolved to the loaded case and opened the pane. Diagnostic removal of duplicate parts immediately restored the center fill hit. `202600819-ZC` had the same four-copy defect, and `202601987-CU` repeated its five parcels twice. In this reproduction the missing-ID hypothesis was not observed: known hits had stable IDs; duplicate overlapping geometry cancelled the rendered interior.

## Changes

- Repair geometry during server snapshot generation and map delivery: clean redundant coordinates, unkink self-intersections, drop zero-area parts, dissolve duplicate/overlapping parcels belonging to the same case, and rewind rings. Preserve valid holes and disconnected parcels. The browser performs no geometry repair.
- Apply repair to legacy map snapshot building, configured-jurisdiction map locations, server viewport responses and area/project map responses. The already-published source is repaired on delivery without a database mutation. Update the committed redacted Ada snapshot's drawing geometry, centroids and bounds. Its raw-source hash and entire self-check report are unchanged, so geometry repair does not invalidate existing evidence approvals or the committed go-live decision.
- Use one all-hit resolver on the home, case and admin maps. Ignore unknown IDs; choose the smallest known project when polygons overlap. Hover and click share the resolver, and unknown-only hits do not produce a hand cursor or tooltip. Clusters and summary dots retain their zoom actions.
- Emit canonical string IDs on polygon features and their properties; every part/tile inherits that identity. Packing/unpacking preserves string IDs. Version the viewport cache and request URL to avoid serving old duplicate geometry from caches.

## Verification

Node 24.18.0: 745 unit tests passed in 152 files, TypeScript passed, ESLint reported zero errors and four pre-existing unused-variable warnings. Normal and database-free Preview builds passed, including client bundle isolation checks.

The repeatable browser harness is `scripts/check-project-clicks.mjs`. Run it against a local Preview production build using `LAW_PREVIEW_URL` (localhost only). It imports installed Playwright, or uses `LAW_PLAYWRIGHT_MODULE` to point to an existing Playwright installation. It uses the real Ada snapshot endpoint. Nampa uses cached public record responses and source geometry in `tests/fixtures/nampa-map-clicks.json`, passed through the actual viewport wire packer, so Preview needs no database. The optional comment email is omitted from that test fixture.

The harness clicks the canvas center with the initial camera centered on each project's area-weighted geometry centroid; it verifies the requested zoom, resulting project URL, visible resident pane and absence of browser page errors. It uses a real touch tap on mobile.

| Area | Project | Zoom 13 | Zoom 15 |
| --- | --- | --- | --- |
| Ada | 201601258-CPA | Pass | Pass |
| Ada | 202300565-CU | Pass | Pass |
| Ada | 202600638-ZC | Pass | Pass |
| Ada | 202600819-ZC | Pass | Pass |
| Ada | 202601987-CU | Pass | Pass |
| Nampa | ANN-00326-2025 | Pass | Pass |
| Nampa | ANN-00333-2025 | Pass | Pass |

Mobile 390×844: Ada `202600638-ZC`, zoom 15, centroid tap opens its pane. Total: 15 passing browser checks. The 33 identical parts of `201601258-CPA` become one polygon; `202601987-CU` has ten source parts and five distinct parcels after repair. The unit transport regression separately covers twelve distinct MultiPolygon parts and canonical feature IDs.

Screenshots and machine-readable results are in [screenshots/2026-10-31-project-fill-clicks](screenshots/2026-10-31-project-fill-clicks/): `ada-center-pane-1440x900.png`, `ada-center-pane-390x844.png`, and `results.json`. Both screenshots show the filled Ada parcel and its pane after a center click/tap.

No production writes, paid AI calls or merge were performed for this change.
