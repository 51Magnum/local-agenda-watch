# Self-reviewing onboarding delivery — October 31, 2026

Implementation remains on codex/ada-site-review / PR #7. No merge or production deployment is authorized or performed.

## Built

- Source-backed per-record checks, configurable type priority/pass threshold/must-include list, aggregate coverage checks, redacted check reports and an offline config-only eSCRIBE sample.
- Existing registry, adapters, collection, scope/copy, hearing state, boundary/geolocation, snapshot hashing, timeline evidence/privacy stores and both AI budget ledgers are reused. No dependency was added. The seven legacy public definitions remain covered by their unchanged manifest test.
- Automatic database approval/publication, source-bound exception decisions in /admin/review, persistent pause, published-record filtering and internal exception alerts. Failed checks cannot be bypassed by JSON approval fields.
- Preview requires an isolated database. CLI writer selection requires LAW_DB_TARGET=preview, a different endpoint, and distinct actual Neon branch IDs. Runtime uses the reader role. No production fallback exists.
- AI fixer uses the existing reserved-budget gpt-4.1-mini path, bounded to three exceptions per production refresh. Development uses mocked models. Verifiable source excerpts/titles and additional document hiding are eligible; invented outcomes are rejected.

## Actual source result

The live read-only collection retained 40 projects and accounted for all 41/41 case-bearing agenda items. The self-check pass rate is 0%, with 66 check exceptions across all 40 records. Automatic go-live is refused. The report records 38 failed case-link checks, 27 incomplete document privacy reviews, and one legacy-format case identity requiring verification. Its identity classification was refined to uncertainty without changing the measured source snapshot/time.

The county tracker find/query URLs both returned HTTP 200 but neither body contained the project number. Public tracker configuration confirms an invisible Search widget with no configured sources; its Query widget filters hearing dates. A generic map shell is not proof of a working case deep link. The curated County GIS HTML alternative did not clear the source checks. Raw JSON links were not accepted as resident application pages.

See reports/jurisdictions/ada-county-selfcheck-2026-10-31.json and .md. These are dry-run artifacts, not deployed staging or approval. Source text and candidate titles are withheld from distributable reports.

## Verification

Node v24.18.0: 715 tests in 145 files pass; TypeScript passes; ESLint has zero errors and four existing warnings; optimized build passes. Client bundle isolation PASS: 41 static files, with no private jurisdiction IDs, source hosts, cost caps or Ada boundary content.

The disabled sample-escribe registry entry reuses the existing eSCRIBE adapter and produces an offline fixture report: 100% record pass rate, no queue, and go-live false because the entry is disabled. No new adapter implementation is needed.

| Regression | Local result |
| --- | --- |
| 202502399-A across August/September/October and 202502461-A | PASS: recorded source rows and agenda fixtures match by project |
| Agenda-only 202600829 and 202600864 | PASS: retained and included in 41/41 coverage |
| Organization subdivision 202600934 | PASS: development description retained |
| Combined 202600273 / 202400171 item | PASS: distinct identities, heard-together relationship |
| Five named title cases | PASS: source words/primary type, bounded length, no ellipsis |
| Official application links | FAIL live: unresolved source checks remain queued; raw-data rejection tests pass |
| Board stage and 9 PM Boise date | PASS: explicit regression tests |
| PDF.js Iterator failure / Node 24 pin | PASS: incomplete collection cannot replace staging |
| COM Hazel Center and winery MSP | PASS: recorded-source scope fixtures |
| 37 homeowner Accessory Use permits | PASS: exclusion regression; actual current-run exclusions are separately categorized in the report |
| Forged JSON launch and persistent pause | PASS: local PostgreSQL-compatible integration tests |

## Pending external verification

No preview database was provisioned or populated. DATABASE_URL_PREVIEW and the Vercel protection-bypass secret are not available locally. No deployed-preview screenshots are claimed. Required views and sizes are listed in docs/jurisdictions/screenshots/2026-11-ada/README.md.

Shane must create the ada-preview Neon branch, reader and writer roles, apply the onboarding/constraint/self-check migrations, provide actual branch IDs, set Vercel Preview DATABASE_URL_PREVIEW to the reader, and configure the bypass secret. Then populate only the preview branch, resolve the source exceptions, verify the fresh Git preview and required checks, and merge only when satisfied.

No production writes, no paid AI in development, no local-file deployment, and no merge.
