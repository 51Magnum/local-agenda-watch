# Local snapshot review captures

Captured October 31, 2026 with Playwright Chromium against `next build` / `next start`, `VERCEL_ENV=preview`, `VERCEL=1`, no database variables and no area-selection variable. No Vercel protection bypass or deployment upload was used.

Each view has `-1440x900.png` and `-390x844.png` versions:

| File prefix | View |
| --- | --- |
| map | Ada map |
| list | Expanded list of 40 Ada cases |
| combined | 202600273-ZC; shared hearing context |
| appeal | 202502399-A alias; Board appeal history |
| agenda-only | 202600864-CU-MSP |
| organization | 202600934-S |
| exceptions | Read-only `/admin/review` queue |
| boise-404 | `/us/id/boise`, expected HTTP 404 |
| sample-escribe | Disabled config-only eSCRIBE sample |

[Machine-readable manifest](manifest.json) records HTTP results, dimensions and SHA-256 hashes. All 16 available pages returned 200; both Boise views returned 404. No JavaScript page errors. Runtime render metrics reported zero database queries/bytes. Screenshots were visually inspected at desktop/mobile sizes.

Review findings: no visible overflow in these captures. The inherited timezone label and excessive redaction of ordinary words were corrected. Source verification and document privacy remain incomplete; Ada stays unpublished. Some project pages lack street-address/location text, several descriptions remain withheld, and source-derived titles can read awkwardly. Those are remaining record/content limitations, not evidence of publication approval. No AI-generated plan or invented source fact is included.
