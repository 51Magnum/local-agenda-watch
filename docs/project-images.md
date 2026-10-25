# Project images

Map refresh only updates geography and schedules. The independent `case-images` workflow starts after the 05:00 America/Denver sweep, at 05:15 (both UTC DST partners are scheduled; the inactive one exits).

Each authenticated `/api/cron/case-images` request leases exactly one case for a roughly 250-second budget. A fast parallel pass creates cached aerial boundary maps for mapped cases with no approved image. The document pass processes up to 40 cases per daily workflow; unfinished document/page cursors resume in later invocations. Manual workflow runs can target comma-separated `area:case` pairs. Queue metadata is in `law_image_jobs`, page privacy results in `law_image_checks`, candidate selections in `law_image_reviews`, and WebP bytes in the existing `law_map_visuals` table. No PDF bytes or duplicate page text are added to the queue.

All live map configs have a `loadCaseDocuments` adapter. Nampa checks public attachments and both PrimeGov meeting lists; county cases use their parsed hearing materials; Meridian uses official packet PDFs and reachable WebLink folders, restricting packet candidates to the case's own section. Public library traversal resumes through the case job's folder cursors. Blocked sources remain explicit and are never bypassed.

Documents are ordered site plan, concept/plat, landscape, elevation/rendering, vicinity/aerial, then report containers. All PDF pages are inspected through text and drawing/image operators. Up to eight likely full pages per document are classified at high detail; the entire page must pass privacy review before its preview is trimmed. Native scanning and classification have separate per-document deadlines and durable checkpoints. Image downloads may be up to 128 MB; the timeline download default remains 45 MB.

Unavailable/unchecked classifications expire after 24 hours. Fingerprint changes create fresh page scan state. `visualCheckedAt` is written only when discovery and every document scan actually finish; blocked or budget-limited work stays deferred. Completed cases are revisited weekly.

A fallback is generated only from known case geometry over attributed aerial imagery, never from an AI drawing. It is captioned `Project area map (not a site plan)`. Citywide/no-geometry cases do not receive a guessed location image. Fallbacks are distinguishable from classified source plans in both metadata and the admin UI.

`/admin/images/<area>/<caseId>` lists private candidate thumbnails, verdicts, confidence, and source pages. Select/Unhide require a passing privacy check. Select writes `manual:true, selected:true`; automatic upserts preserve manual rows and publication gives that selection precedence. Rescan preserves manual selections and cached privacy checks. `/admin/images?filter=fallback` lists cases whose only approved option is the boundary map. Unchecked/rejected thumbnails are served only by the authenticated admin endpoint; the public image endpoint still validates catalog visibility and the full image hash.

The workflow logs per-case results and before/after coverage. Run `npm test` for long-PDF, retry, manual-pick, source privacy and PostgreSQL queue regression checks.

Vision explicitly returns handwriting, signature, context-map and plan/map flags. Handwriting/signatures are rejected even on genuine plans; topography/zoning/land-use maps are context, not proposed site plans. Candidate pages with transient failures remain unavailable. A case-specific minimum-review hold can withdraw older automatic checks without removing its safe fallback; new checks must meet that version before publishing. Rejected candidate images are retained only as small admin-only thumbnails. Public metadata queries exclude hidden/rejected rows and enforce source withdrawals in SQL.

Downloads use a total deadline across EnerGov byte ranges and redirect hops. A timed-out source invocation leaves its checkpoints/lease for retry; the scheduled backfill continues with the next case rather than abandoning the batch.
