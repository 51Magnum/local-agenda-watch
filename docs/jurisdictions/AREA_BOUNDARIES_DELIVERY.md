# Visible-area map boundaries

The home map used a generated file containing only build-time legacy areas. Snapshot-published areas could supply projects without supplying coverage, outlines or labels.

All three resident map components now request `/api/map/boundaries`. Its authority is `visibleCoverageAreas()`: production uses legacy areas plus `readPublished()` snapshots; Preview uses approved legacy coverage plus review snapshots. Legacy coverage metadata does not enable database-backed legacy project access in Preview. Unpublished areas are omitted, and a snapshot-store failure retains legacy coverage without retaining stale snapshot geometry. The admin preview map is unchanged.

The endpoint returns `{version, polygons, labels, uncovered}`. Both outlines and the world-minus-covered mask use `coverageBoundary ?? boundary`; Ada's coverage excludes Meridian, Kuna, Star and Eagle. Shapes use tolerance 0.0006 and precision 5. The version includes visible IDs, geometry and snapshot hashes. Bodies are cached by version, gzip encoded when accepted, and served with an ETag and mandatory revalidation so publication changes are checked on the next request. The generated static fallback is legacy-only. New jurisdictions require no map code, static-file edits or new environment variables.

## Verification — October 31, 2026

- Node 24.18.0: 738 tests passed across 150 files; five new endpoint tests cover Preview, publication gating, county city exclusions, unreachable storage, snapshot hash changes, ETag and gzip.
- TypeScript: no errors. ESLint: no errors, four existing unused-variable warnings.
- Normal and Preview production builds passed. The screenshot server runs the Preview build with `VERCEL_ENV=preview`, `VERCEL=1`, and both database variables explicitly empty; Next cannot refill them from `.env.local`.
- The first full run encountered an existing Windows temporary-directory lock error in `timeline.test.ts`; the complete rerun passed all 738 tests.
- Old generated static payload: 201,971 bytes raw / 47,528 bytes gzip (seven legacy areas). New local Preview endpoint: 356,474 bytes raw / 83,567 bytes gzip (seven legacy areas, Ada and the disabled eSCRIBE review sample). Gzip sizes use Node's default level; the new size was measured from the actual HTTP response.
- Eight screenshots at 1440×900 and 390×844 are in [screenshots/2026-10-31-area-boundaries](screenshots/2026-10-31-area-boundaries/): `treasure-valley-boundaries-{on,off}-{1440x900,390x844}.png` and `kuna-south-ada-boundaries-{on,off}-{1440x900,390x844}.png`.
- Ada and Canyon have matching covered shading and outline treatment. Switching boundaries off hides outlines and labels while retaining coverage shading. Labels retain the existing zoom threshold of 9, so the mobile Treasure Valley overview at zoom 8 does not show jurisdiction labels; the south Ada view does. No browser page errors were observed.

No production writes, paid AI calls or merge were performed for this change. Deployment remains Git sourced.
