# Cross-jurisdiction radius maps

`/{country}/{state}/map?lat=...&lng=...&r=...&q=...` is the address/pin view. `r` is miles (0.25–10, default 1). Existing area maps still show that area's inventory; address searches, dropped pins and old location-bearing area links open the combined view. Plain area map and project map URLs remain supported.

The registry's `boundary` is the full county boundary or official city limits. `coverageBoundary` remains a separate planning-authority / service area asset, used for legacy area lookup and county FLUM exclusion. Nampa city limits were refreshed from its official GIS layer 6; its previous area-of-impact asset is retained separately. All live boundaries intersecting the circle participate, including a county containing a city.

`/api/maps/nearby` selects cases whose outline bounds intersect the circle's bounding box inside Postgres, then applies distance-to-polygon filtering. Legacy snapshots without cached bounds are filtered server-side using their geometry coordinates. FLUM likewise uses bounded database projection; it does not transfer an entire jurisdiction's polygons to the browser. Missing cached sources are reported without hiding working jurisdictions. Search strings are not logged or stored by the endpoint.

Every map case has a namespaced ID and retains member jurisdiction, case ID, official body, stage and project URL. Matching parcels within a common parcel source or intersection-over-union above 80% combine into one shape. City cases supply the primary stage when a county referral duplicates them; every linked case remains visible. A Watch action saves all linked projects.

Stages share the existing colors; P&Z is labeled Hearing in the combined legend, with actual body names on cards. The nearby list uses distance to the outline, not centroid, and jurisdiction chips filter both list and map. No-location / citywide projects are not assigned guessed distances.

Future Land Use follows each published plan polygon, including city plan areas outside annexed city limits. City plans take precedence over county colors where their published extents overlap; native source categories and plan publisher labels are retained. Original categories remain on clickable features, while a common display legend groups explicit low/medium/high residential, commercial, industrial, agriculture/rural, mixed use, and public/open space. Residential without a density and unknown categories are explicitly unclassified rather than guessed. These groups do not assert zoning compatibility.

Saved follow-place requests persist coordinates and `radius_miles` in Neon. Jurisdiction membership is recomputed from the current registry when read, so newly live areas join an existing radius automatically. Legacy follows with coordinates default to one mile. Text-only waitlist interests remain text-only; they are not silently geocoded. Email delivery is still the existing coming-soon waitlist, not an active alert sender.

Verification location: 4917 E Victory Rd, near S Happy Valley Rd, Nampa (`43.5756774,-116.5099174`), one mile. Local snapshot: 15 cases grouped into 12 shapes across Nampa and Canyon County. Counts can change with source refreshes.

## FLUM coverage and clearing a search

FLUM follows the visible viewport, independently of the project search circle. The client requests bounded plan geometry after panning/zooming, with a short debounce and an explicit loading hint. A cleared address (or `/us/id/map` without coordinates) requests `overview=1`, removes the pin/radius filter, and fits all live coverage boundaries. No hidden one-mile query remains.

`/api/maps/nearby?bbox=west,south,east,north&layer=flum` selects plan features by database bounds and clips to the viewport, not city limits. Broad views generalize geometry to display resolution; closer views request finer detail. A spatial grid restricts county/city overlap calculations to intersecting plan polygons.

Regression: Braeburn's centroid is outside Nampa's current city limit but inside its published Medium Density Residential plan polygon. `lib/maps/fixtures/braeburn-flum.json` contains that official Nampa FLUM layer 30 feature from the existing GIS cache. A city-limit mask must not erase it.
