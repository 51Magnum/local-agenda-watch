# Ada after self-check tuning

Retaken October 31, 2026 using local Playwright Chromium against an optimized `next build` / `next start` with VERCEL_ENV=preview, VERCEL=1, no database variables and no area-selection variable. No Vercel protection bypass or deployment upload.

Every prefix has both `-1440x900.png` and `-390x844.png`:

| Prefix | View |
| --- | --- |
| map | Ada map, review-only banner |
| list | Expanded list of all 40 safe review projections |
| combined | 202600273-ZC / Bellarosa; shared-hearing project |
| appeal | 202502399-A alias / Palermo; Board appeal history |
| agenda-only | 202600864-CU-MSP / fitness facility |
| organization | 202600934-S / subdivision |
| exceptions | Read-only queue: two conflicting descriptions |
| boise-404 | Expected unavailable Boise route |
| sample-escribe | Disabled fixture area still renders |

[Manifest](manifest.json): 18 captures, verified dimensions and hashes, 16 HTTP 200 results and two expected Boise 404s; zero JavaScript page errors. Runtime render metrics show zero database queries/bytes. Desktop/mobile map, list, project and queue captures were visually reviewed. Map framing was reset to the top so the review banner remains visible.

The gate passes at 38/40 (95%) with 41/41 agenda coverage; the two queued records remain ineligible for production. County staff-report links and restricted data links now appear where valid. All 40 earlier titles are documented in [the title audit](../../ADA_TITLE_AUDIT_2026-10-31.md).

Remaining content limits: some locations cannot resolve a reliable intersection and use the county fallback. Official descriptions can be lengthy on mobile; they are retained as sourced facts. AI summaries remain pending because no paid model was used. The two ambiguous APPFILEs have unverified application links suppressed. No obvious horizontal overflow was observed. These are review captures, not production publication evidence.
