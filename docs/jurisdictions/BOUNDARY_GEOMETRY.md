# Accurate jurisdiction outlines

The old display builder simplified every boundary at 0.0006 degrees and reused it at street zooms. Narrow rings became triangles and diagonal shortcuts. It also drew Nampa's overlapping city/impact coverage parts as its jurisdiction outline.

City outlines now use official city limits. County outlines retain unincorporated coverage, and the uncovered mask continues to use the full registered coverage geometry, including planning-impact coverage. Source collection preserves original precision and dissolves overlapping polygon parts without Douglas-Peucker simplification. Display geometry is normalized at six decimal places; islands and holes remain polygonal, and the final mask is normalized again to remove degenerate intersection remnants. No boundary is snapped to imagery.

Nampa's city-limit cache was refreshed from the official Nampa City Limit layer on November 6, 2026:
https://utility.arcgis.com/usrsvcs/servers/3543690ae3bf41a1a77b9b9b2bc477ca/rest/services/Public/NampaOpenData/MapServer/6
The raw response hash and the intentional Nampa baseline update are recorded in legacy-area-manifest.json. Planning-impact coverage is retained separately.

The East Amity Avenue / East Railroad Street regression uses two source-derived points: a diagonal introduced by coarse simplification must not render, while the nearby official edge must render. Browser checks cover home, project, area and coverage maps at zooms 15 and 17, in Map and Satellite, on desktop and phone. Independent geometry validation confirms all nine visible outlines and the mask are valid.

The measured nine-area payload grows from 356,575 to 1,206,197 bytes (83,246 to 293,961 bytes gzip). The client revalidates publication with ETags, reuses parsed data on 304, and avoids re-uploading unchanged sources while panning. Source failures still fall back only to legacy geometry, never stale published snapshots. Server geometry/mask caches are bounded and keyed by actual geometry.

No new environment variables, services, migrations, paid AI or production shell writes. New jurisdictions automatically use the same collection and rendering path.
