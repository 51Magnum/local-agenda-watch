# Jurisdiction maps

## Operation

Run npm run maps:sync to populate the local .data/maps cache. The existing hourly /api/cron/case-timeline job also refreshes configured maps. Geometry refresh is independent of AI extraction and failures do not stop document ingestion. Production uses DATABASE_URL (Neon), in the law_map_cache table; table creation is automatic. Development uses ignored JSON files. The map API warms an absent cache, but otherwise reads the stored snapshot. A failed upstream layer retains cached outlines and their original verification timestamps, with a warning. Future land use is simplified to tolerance configured in geographic degrees and refreshed every seven days.

The worker still requires its existing extraction-key configuration before starting the combined job. No new API key is required for maps. npm run build and npm run dev copy the installed MapLibre module worker and license into public/maplibre. These generated files are ignored by Git. The proxy bypasses this static directory on locality subdomains.

## Add an area

Add one entry in lib/maps/jurisdictions.ts. Routes /<id>/map and /api/maps/<id> are shared. Set mapOnHub when the city hub embeds the full-page map; the legacy map route then redirects permanently to the hub and the sitemap includes only the canonical city URL. Other configured areas can retain their standalone map route until their hub is ready. Configure case layers and field mappings, parcel service and matching field, ignored placeholder parcels, citywide type codes, stage mappings, address service/state constraints, and FLUM metadata. FLUM colors come from the ArcGIS unique-value renderer. Optional loadCases and recordClient adapters supply hearing schedules and parcel numbers from case records; optional presentation formats titles, descriptions, project links and curated hearing information. With those adapters omitted the GIS layer is sufficient to render a map. Embed CaseMap with the area ID on its hub or project page.

Nampa uses ACCOUNT for Canyon County parcel matching, never PIN. R1542600000 is excluded. Citywide text/code amendments have no geometry or centroid even if the city provides its office polygon. Unlocated property cases remain in an explicit unverified-location list. Recording phase alone is Decided; both the configured phase and completed/recorded status are needed for Recorded.

Nampa planning guidance says the 2040 plan was adopted March 2020; the GIS layer description refers to underlying data adopted in 2019. Both are disclosed. FLUM overlays may lag plan amendments. Main project categories require at least 1% of mapped site coverage to avoid tiny boundary slivers from source alignment or simplification. All polygons remain visible/selectable in the overlay.

## Address privacy

Search runs only on form submission. The browser queries configured address points first, then POSTs to a stateless Census fallback. That handler uses onelineaddress and Public_AR_Current, rejects results outside the configured state, sends no-store headers, and does not write addresses to logs, files or PostgreSQL. Browser session storage caches up to 30 searches for 24 hours. Share URLs put address/coordinates in the fragment, which browsers do not transmit in HTTP requests or Referer headers. Geocoding providers receive the submitted address, as disclosed in Privacy. Never add request-body logging or analytics to the search route.

Nearby distance is the shortest geodesic distance to the case polygon, with zero for points inside it. The optional Within 1 mile checkbox filters case outlines against that radius, with current stage/type filters also applied. It is disabled until an address is selected. There is no nearby-case sidebar. Hovering an outline opens a short project popup; clicking or tapping pins the popup so its project link is easy to follow. Citywide and unlocated cases remain available through the All cases link and are never assigned a guessed pin. Share fragments preserve the nearby checkbox using nearby=1.


## Popup exhibits (no AI)

Each jurisdiction may supply caseVisuals keyed by exact case ID. Entries identify the image, full-size link, document/page source, dated label, and whether it is a proposal or planning context. These are reviewed source exhibits; the application does not generate artwork or infer a development layout. Public map data attaches current exhibit metadata even to an older geometry snapshot. Thumbnails use the Next image optimizer and link to the complete exhibit. No exhibit means a text-only popup.

Braeburn's two related cases share the developer's March 13, 2026 concept, explicitly labeled as an early concept that can differ from later filings. Northside's zoning image is labeled context, not a proposed layout. A geographically aligned image overlay would require verified image coordinates/control points and rotation; a parcel bounding box alone cannot reliably place an arbitrary PDF page on the ground.

Braeburn preview is a deterministic crop of the existing 1800×2332 WebP (left 243, top 373, width 1350, height 1259), resized to 768 pixels wide with WebP quality 85. It removes page margins for legibility; the full original exhibit remains linked. No generated or altered development design is used.

Direct pin placement uses the clicked coordinates locally, with no geocoding request. Select Drop pin, then click/tap the map; Escape or Cancel pin exits placement. It shares the same radius filter and location link as address search. The fragment adds pin=1 so shared pins restore as coordinates, without pretending to be street addresses. A newer pin selection supersedes pending address-search results.

## Personal watches

Popup Watch checkboxes store only jurisdiction, project path, display title and related case IDs under law:watches:v1 in localStorage. Watches are grouped by project path, so related cases produce one personal project. The city page supplies current catalog information for status and next hearing; stored preferences are not treated as current evidence. The You are watching section updates via same-tab events and cross-tab storage events. Users can uncheck Watch there or in a popup. No account, server write, email alert or cross-device sync is involved. Corrupt entries and unsafe paths are ignored; blocked writes show an error. The complete case inventory, including editorial project guides, unlinked/stale cases and decisions, remains in a collapsed All cases section which opens on stage-filter URLs.

Nampa uses /nampa as the main map and city page. Its compact header links to Watching, Meetings and All cases below the map. /nampa/map returns a permanent redirect with query parameters retained; browsers inherit the original location fragment, preserving shared address and pin links.
