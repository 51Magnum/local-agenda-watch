# Map-first homepage acceptance checklist

Every resident-facing change must answer, in order: What is it? Where is it? What's happened? What's next? How it affects me? How can I act? Hide unsupported impact facts; say when the available records do not confirm a next hearing. Never invent a decision, appeal deadline, location, or comparison with surrounding density.

The homepage is a full-height map with a shared desktop pane/mobile sheet. Existing area/project/calendar URLs remain canonical and usable. Deep links use `?project=area/case-id`; Back closes a pane opened from the map. Saved places and last map views remain in the browser. Email capture remains a waitlist, not active alerts.

`law_map_cases` is an additive materialized projection of the existing map snapshots, with indexed centroid and stored bbox columns. PostGIS is not required. Initial migration seeds from existing snapshots and cached locality metadata, once. Map refresh upserts changed rows and invalidates the map index tag. Public map feature responses contain no PDF text, images, pending evidence or full timelines. Project details use the same overview/timeline/public-field functions as project pages.

`/api/map/cases` canonicalizes bbox/zoom to shared grid keys, adds a 20% margin, caps at 1,000 and signals truncation. Below zoom 9 it returns area counts; zooms 9–10 return clustered centroids; 11+ returns simplified outlines. The client caches cells and debounces movement 300ms. Application data cache and edge cache protect Neon. Metadata revision changes produce new edge cache URLs after refresh. Cached response headers can describe the original cache-fill request: do not mistake an edge-replayed origin-query header for a new database query. Measure origin cache behavior and Vercel cache status separately.

Published FLUM planning extents are preserved outside city limits. City plan colors take precedence, county coverage fills elsewhere, and every picked designation names its source. Coverage boundaries and plan boundaries are different concepts.

Preview only until explicit production approval. No production cron or new email delivery system is enabled by this UI change.

## Future PMTiles switch (not enabled)

At roughly 10 covered states, or sustained dense-view truncation/payload growth, benchmark a vector-tile source before adding more JSON API capacity. Run `npx tsx scripts/export-map-tiles.ts --dry-run` to inspect the export, then omit `--dry-run` to compile with current [felt/tippecanoe](https://github.com/felt/tippecanoe). `--upload` uses [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk) with the runner's configured access. Files have content-hash names and contain geometry and public map labels only. No resident signup data, document text, or pending decisions enter tiles. When approved later, add this command after each completed daily sweep, publish a tiny version manifest, and point MapLibre at a PMTiles protocol source; keep pane details as a separate API. The prepared workflow runs after successful morning sweeps on main, but exits immediately until Blob access is configured. Its export endpoint is authenticated, paginated, and capped below serverless response limits. This does not switch the live renderer or change the timeline schedule.

The resident pane is the primary map project view. It links directly to known readable city/county project records or hearing records; raw GIS queries are never substituted. Existing full project URLs remain available for saved links and search indexing during the transition. Outlines appear from zoom 11, with thinner borders at city scale. Cases without polygons retain a centroid dot.
