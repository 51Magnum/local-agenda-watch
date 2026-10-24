# Meridian initial adapter

Local preview: `/us/id/meridian`, `/map`, `/meetings`, `/plan/H-2026-0036` (Momentum).

Sources: Development_Feature_Layer/FeatureServer/6, official Clerk public-hearing notices, and the Council/P&Z Municode publish pages linked by the Clerk. FLUM: CD/FLUM_Webservice/MapServer/15 (class2, renderer colors). Boundary: CD/Boundaries_places_Webservice/MapServer/2, captured October 23, 2026.

The GIS and agenda archive are independently collected. Active applications and applications from the previous year onward are included, deduplicated by App_ID. Approved cases may remain Active=Y while findings or agreements are outstanding. Active and Appr_Date alone never establish approval. A P&Z Approved field is conservatively In review until a final decision is established; Council Approved/Denied is treated as a reported decision. Future published notices take precedence over a stale GIS hearing date.

The Clerk notice page returned Cloudflare 403 to server requests during implementation, but loaded normally in the browser. Its public table was captured through the browser on October 23 and parsed into the dated initial snapshot at lib/sources/snapshots/meridian-notices.json. This is a real official-source snapshot, not generated hearing data. The hourly reader continues trying the live page. During failures it retains the last verified notices and displays both an unavailable message and the notice-verification date; it never claims the notice feed was successfully refreshed. Older notices are not used as future hearing dates once their date has passed. A successful live page replaces the snapshot normally. Renew the initial snapshot from the official browser-visible table or a successful public fetch if needed before launch; sustained unattended notice access remains a launch consideration.

Municode agendas are matched by an item's own heading, not every case ID referenced in its attachments or background narrative. Published agenda, packet, minutes and recording links are retained. This first archive reads the latest page of each body, not the entire historical archive. Minutes are linked, not interpreted as approved outcomes by AI.

Unnumbered notices are joined only when the official document-folder ID matches a GIS record; they never get invented case IDs. Consent-agenda references are not advertised as new public hearings.

No universal noon comment deadline is assumed. The city distinguishes exhibits from written testimony; use the official participation instructions. A notice date without a published time remains date-only and has no calendar download until a matching agenda supplies a time.

Citywide is based on the official notice's location, not a dummy GIS office parcel. No FLUM/zoning compatibility verdict is inferred: the plan's examples are not exhaustive. Parcel acreage and lot counts are not silently converted into approved homes or units. AI PDF summaries and proposal image extraction remain a later collection phase, with existing review gates intact.

Source snapshots use the shared Neon law_source_cache keyed by meridian, or ignored local .data/meridian-feed.json. Map snapshots use the existing law_map_cache. The hourly map job refreshes areas independently.
