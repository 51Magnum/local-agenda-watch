# Map and Satellite basemaps

Every map has a Map / Satellite switch under Layers: the home explorer, project and area maps, location coverage maps, and admin jurisdiction previews. The first view defaults to Map. The choice is shared between maps in the same browser-tab session and remembered on reload using session storage. If storage is blocked, switching still works in memory. Both buttons have 44px tap targets. Existing layer controls remain alongside the switch; new Layers controls expand in the toolbar instead of covering project panes.

The raster source is [USGS Imagery Only](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer?f=pjson), using the supplied `/tile/{z}/{y}/{x}` URL, 256px tiles, native maximum zoom 16, and “USGS The National Map” attribution. Higher map zooms overzoom the level-16 imagery. No key, environment variable or paid service is required. An actual tile returned HTTP 200, JPEG content and wildcard CORS during verification.

`lib/maps/basemap.ts` installs once, before LAW adds application layers. It records the original basemap artwork's visibility and inserts the imagery below the first OpenFreeMap symbol layer. Satellite mode hides only original non-symbol artwork. OpenFreeMap's road/place symbols remain above the imagery, and every later LAW layer remains above it: pins, circles, project geometry, boundaries, coverage shading and future land use. Map mode restores original visibility, including originally hidden layers. Switching does not call `setStyle`, replace sources, recreate the map, move the camera or reload the page.

The existing single compact attribution control remains in place. MapLibre adds the raster source's USGS credit when that source is visible and removes it when hidden. OpenFreeMap, OpenMapTiles and OpenStreetMap credits remain because their labels are retained. Switching does not expand attribution.

Validation on Node 24:

- 932 tests in 170 files pass. The full local run uses `npm test -- --maxWorkers=4` to avoid the existing preview-isolation cold-import timeout under unrestricted worker concurrency; no timeout or isolation check was relaxed.
- Typecheck and optimized build pass. ESLint has zero errors and four pre-existing warnings.
- After building, `node scripts/check-map-ui.mjs --satellite` passes 44 desktop/mobile browser checks at 1440×900 and 390×844. It verifies actual raster requests, labels and application-layer preservation, unchanged camera and document lifetime, session reload, active attribution, all five saved pins and their circle, and a polygon-center click/tap in Satellite mode. Active future-land-use source data is checked on project and area maps.
- The browser harness observes real MapLibre instances through a test-only bundle wrapper and mocks public fixtures/raster tiles. It does not add a debug hook to production or access a database, account, email service or AI provider. Playwright uses the existing `LAW_PLAYWRIGHT_MODULE`/`LAW_PLAYWRIGHT_CHANNEL` test convention.

No production writes, migrations, new configuration or paid AI calls were made.
