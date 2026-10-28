# Ada resident-facing review

The `codex/ada-site-review` Git preview presents Ada through the normal home map, jurisdiction map, case pages, search and source links. It uses the standard resident project pane, with verified application types/statuses, sourced hearing records and qualified participation deadlines. Boise is excluded.

This is a site review, not an admin-dashboard review. Open `/us/id/ada-county` or `/us/id/ada-county/map`; project pages use `/us/id/ada-county/plan/<case-number>`. No application admin password is required. Vercel may still require the owner's existing preview access.

`LAW_SITE_REVIEW_AREAS=ada-county` is scoped to this preview branch. The generated manifest makes server and browser visibility identical. The generator refuses that setting for a production build. Production publication remains unchanged, and neither a passing full QA report nor a publication approval is fabricated.

Review geometry and project/search overlays read private staging directly. They do not write to the shared production map cache or consolidated site index. Existing residential privacy rules still apply; internal GIS codes are replaced with their human-readable source fields. Unreviewed document images are withheld while the location map remains available.

The normal seven areas remain accessible. Check Ada on the home map, open several projects, follow official document links, and review participation wording. Earlier hearing history is explicitly incomplete. Production promotion remains a separate decision after this site review.
