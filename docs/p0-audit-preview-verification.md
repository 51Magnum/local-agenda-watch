# P0 audit preview verification — October 25, 2026

Preview: https://local-agenda-watch-jvirhqoom-shane-s-projects-e4093d06.vercel.app/

Production was not promoted. Branch: `codex/map-first-home`.

## Changes

- Scheduler accepts Denver 05:00–09:59 and 14:00–18:59 windows, with one completion per slot. GitHub schedules at 12:00/21:00 UTC, inside these windows in both seasons. Unexpected skips fail; completed slots are successful no-ops. Manual force is available.
- Admin shows stale source sweeps and hearings whose results have been pending more than 14 days. No mail helper exists, so warnings appear in logs and the protected admin dashboard.
- Same-site groups consistently use the active lead for title, stage, color, URL and next step; historical cases appear under “Also on this site”. Hearing dates use the area's timezone.
- Continued hearings show sourced history and an explanation when the old posted comment deadline has passed. Closed cases hide comment instructions and calendars.
- Contact emails, a correction policy and a working correction form/inbox replace placeholders. Reports have a honeypot and an atomic five-per-hour hashed-IP limit.
- Residential permits use block addresses and broad approximate circles; document images and sensitive document names are suppressed. Admin privacy overrides are available. The six guiding questions remain visible.

## Forced preview run

HTTP 200, status `completed`; modes `forced-full-sweep`, `source-discovery-only`; 545 documents checked/processed, 0 AI calls, 0 tokens. All seven source-success timestamps updated at 2026-10-25 18:13:35 UTC / 12:13:35 Mountain.

The explicitly approved local admin and cron credentials were copied into encrypted Preview variables for this branch only. There was no local OpenAI key to copy. Consequently this verification deliberately checked source feeds and discovery metadata without AI PDF extraction. Production variables were not changed.

| Area | Cases in source feed | Known documents | Last successful source sweep |
|---|---:|---:|---|
| nampa | 75 | 311 | 2026-10-25T18:13:35.124Z |
| meridian | 218 | 188 | 2026-10-25T18:13:35.124Z |
| canyon-county | 302 | 432 | 2026-10-25T18:13:35.124Z |
| kuna | 71 | 60 | 2026-10-25T18:13:35.124Z |
| star | 17 | 25 | 2026-10-25T18:13:35.124Z |
| middleton | 5 | 6 | 2026-10-25T18:13:35.124Z |
| eagle | 114 | 54 | 2026-10-25T18:13:35.124Z |

This was a real forced invocation through the authenticated preview admin route, not a GitHub Actions execution. The workflow's updated HTTP/JSON checks are committed; a GitHub-hosted run log has not been produced here.

Discovery retained four explicit warnings: one Nampa case-record timeout; Meridian hearing notices unavailable with cached associations retained; a blocked Meridian WebLink folder; a blocked Kuna SharePoint folder. Meridian Municode, Star Municode, and Eagle Granicus/S3 hosts worked. Successful source-feed checks do not imply that every external document downloaded or every decision was extracted.

## Tests and browser checks

450 tests passed across 82 files; TypeScript check passed. Vercel preview build passed.

- Meridian H-2025-0052 resolves to H-2026-0053, Thruston Choi Farms, City Council October 27 at 6 PM Mountain. Historical case remains listed.
- Meridian Touchmark H-2026-0047 shows its November 19 planning hearing.
- Eagle Costco RZDA-2020-05-MOD1 shows City Council October 27 at 5:30 PM Mountain.
- Canyon CR2024-0010 shows the October 8 → December 15 continuance and the expired September 28 comment deadline.
- Nampa CUP-00412-2026 and CUP-00413-2026 show block addresses, approximate circles, no document image, and no closed-case comment instructions. Full project HTML also contains block addresses and excludes the known exact house number.
- A clearly marked preview test correction was submitted, confirmed in the admin inbox, and marked resolved. No email was sent.
- No browser JavaScript errors occurred during the seven-case check.

## Local evidence

Artifacts are in `output/` and intentionally not committed:

- `audit-forced-sweep.json` — full forced-run response and counts
- `audit-run-summary.txt` — admin run log, hosts and warnings
- `audit-live-verification.json` — seven-case API verification
- `audit-tests.txt` — full test result
- `audit-meridian-H-2025-0052.png` and `-details.png`
- `audit-meridian-H-2026-0053.png` and `-details.png`
- `audit-meridian-H-2026-0047.png` and `-details.png`
- `audit-eagle-RZDA-2020-05-MOD1.png` and `-details.png`
- `audit-canyon-county-CR2024-0010.png` and `-details.png`
- `audit-nampa-CUP-00412-2026.png` and `-details.png`
- `audit-nampa-CUP-00413-2026.png` and `-details.png`
- `audit-admin-health.png`
- `audit-correction-receipt.png` and `audit-correction-inbox.png`
