# Map publication cache consistency

The missing Ada overview circles were stale viewport responses, not missing geometry or marker coordinates. Exact home-map grid URLs at zoom 10 returned Vercel cache HITs with zero Ada records after publication. A fresh request returned Ada records with valid centroids; some zoom-11 cells were already fresh, explaining polygons appearing only after zooming in.

Map metadata now exposes a compact revision derived from the indexed-data revision and the sorted visible area IDs plus approved snapshot hashes. The home map includes it in both its viewport request URL and in-memory cell key. Publishing, pausing or replacing an approved snapshot changes those keys across every zoom. Server viewport caching also includes current publication identity, and area tags come from the same visible-area lookup. Legacy map rendering, clustering and polygon geometry remain unchanged.

Validation on Node 24:

- `npm test -- --maxWorkers=4`: 948 passed, 0 failed (175 files).
- `npx tsc --noEmit` and `npm run build`: passed; client bundle isolation passed (48 static files).
- `npx eslint .`: zero errors, four existing warnings.
- `node --import tsx scripts/check-map-ui.mjs --publication-cache`: six desktop/mobile checks passed. Real MapLibre rendering uses the committed Ada snapshot and simulated pre-publication cached responses. After a publication revision changes, the test checks actual rendered overview markers or cluster leaves belonging to Ada, then zooms in and checks polygon source IDs. No screenshots, database, email or AI calls.

No migrations, configuration, secrets or paid services are required.
