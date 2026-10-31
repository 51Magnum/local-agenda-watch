# Ada self-check tuning — October 31, 2026

The live command `npm run law:jurisdiction -- check ada-county --dry-run --collect` retains 40 records, passes 38/40 (95%), accounts for 41/41 agenda items and returns go-live true. Two records remain withheld. No threshold, coverage, budget or snapshot-preview isolation safeguard was relaxed to hit a target.

| Root cause / reported exceptions | Before (9e291b2) | After |
| --- | ---: | ---: |
| Disabled Services Directory / f=html links | 22 | 0 |
| Privacy scan applied to linked public-document contents | 11 | 0 |
| Large/shared document identity checks | 5 | 0 |
| Unset privacyReviewed required forever | 27 | 0 |
| Legacy case identity | 1 | 0 |
| Newly surfaced conflicting APPFILE source descriptions | 0 | 2 |
| Total owner queue | 66 | 2 |

## Remaining queue

- **202103209-S:** the restricted exact-APPFILE query returns three distinct rows with different `AppApplicDesc` values. Exactly one canonical public record is required. The case remains withheld.
- **202300644-S:** the same query returns two distinct rows with different `AppApplicDesc` values. The case remains withheld.

The raw query also returned identical duplicate GIS features for two other projects. `returnDistinctValues=true` collapses identical public attributes, while conflicting descriptions remain separate and fail the unchanged exact-one-record rule. No row was selected arbitrarily to make these cases pass. The dated JSON/Markdown self-check report retains the official query links.

`03006-CU` has one actual source row with APPFILE exactly equal to its record ID, source project number 200300068, and no conflicting related IDs. It passes the requested legacy rule. Its individual applicant identity is not copied into LAW; it remains eligible under the existing hearing/development scope. This explains why the outcome differs from the suggested 39/40 plus one legacy exception.

## Generic corrections

- Registry `recordLinks.kind=jsApp` binds the primary full-APPFILE tracker link to an HTTP-200 page plus a restricted exact-record JSON verification query. The same restricted public query is secondary, labeled County records (data). No f=html case link is emitted.
- Privacy checks examine LAW title, description, address, document/link labels and query strings, with the redacted snapshot scanned separately. Official county document bodies may name applicants or staff without failing a link. Individual letters/unclassified submissions and residential documents stay hidden and queued. The two agenda-only records had planner contact tails in parsed prose; the parser now removes that metadata before LAW publishes it.
- Configured county-authored kinds require the configured official host, agenda path and query scope. A matching official filename plus HTTP PDF availability supplies identity without downloading an oversized county report. Other PDFs use the first three physical pages. Unreadable sources remain uncertain and retry automatically, outside the owner exception queue; retry-only delays do not send correction alerts. PDF text and images are never submitted to a paid model in this run.
- Source geometry uses the existing street-intersection service for approximate Near labels, with a county location fallback if it cannot resolve an intersection. No house address is invented. Residential geometry is never sent for an exact lookup.
- [Every earlier review title](ADA_TITLE_AUDIT_2026-10-31.md) is audited before/after. The general builder prefers primary type and a named subject/physical use, removes procedural repetition, retains only source words and stays within 70 characters. A surname shared with a project name or ordinary noun no longer erases an entire safe field; complete private identities and contacts are still removed. Browser metadata uses the same useful project title.

## Flaky test and migrations

The original chat output identified `lib/maps/case-index.test.ts`: expected 19 SQL calls, received 20 on a repeated cached viewport. The unexpected SQL was the publication-authority query. The test now distinguishes mandatory uncached authority reads from map/index reads, derives the authority count from registry candidates, and isolates unrelated content/privacy stores. It still requires zero repeated map/index queries. A subsequent overlap run exercises the full suite during a build.

All PR migrations have down files: 20261026 hearing meetings, 20261027 onboarding, 20261028 constraints and 20261031 self-check. The idempotent migration test covers repeat application and self-check rollback/reapplication. No production migration was invoked from this workspace.

## Validation and release

Node 24.18.0; 733 tests in 149 files; TypeScript passes; ESLint zero errors/four existing warnings. Optimized Preview builds with VERCEL_ENV=preview, VERCEL=1 and no database or area-selection variables. Snapshot-only preview, pool-creation prohibition, pause, production drift gate and AI budget caps remain active. Screenshots: `screenshots/2026-10-31-ada-county-tuned/` at 1440x900 and 390x844.

With this gate passing, merging PR #7 enables automatic production refresh/publication of the 38 passing Ada records. The two ambiguous records stay held; fresh production checks and the existing snapshot-drift gate still run. Shane controls merging. No production writes, paid development AI, bypass/protection changes, local-file deployment or merge occurred.
