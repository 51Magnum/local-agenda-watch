# Current result after self-check tuning

Ada now passes 38/40 (95%), has two source-description ambiguities, and go-live is true. See [the current tuning report](ADA_SELFCHECK_TUNING_2026-10-31.md) and [updated screenshots](screenshots/2026-10-31-ada-county-tuned/README.md). The material below records the earlier zero-setup delivery and its pre-tuning 0% result.

# Zero-setup jurisdiction review — October 31, 2026

Branch: `codex/ada-site-review`, PR #7. Shane controls merging.

## Onboarding

Follow [Adding a jurisdiction](ADDING_A_JURISDICTION.md): configure an existing adapter, run the dry-run check, commit its snapshot/report, review the Git preview, then merge. No separate preview database, roles, migrations by hand, Vercel variables or protection bypass are required.

`data/review/<area>.json` contains resident project projections, map/feed data, redacted checks, exceptions and the decision. It excludes raw application fields, individual applicant identities, staff contacts and documents held by privacy checks. Safe held records are visible for review and labeled unpublished; their production eligibility remains false. Preview never creates a database pool. Timeline reads are empty; subscriptions and admin writes are unavailable. The exception queue is read-only committed evidence.

Production refresh waits for the merged Git commit to be deployed, applies the versioned onboarding migrations under a transaction/advisory lock, and collects again. Before first publication the gate compares record identities, eligibility, source hashes and check results against the committed baseline (maximum three changed records); a changed go-live decision always blocks. Drift is queued in `/admin/review` and recorded in the report. Existing production budget caps, publication criteria and the durable pause remain active. No production run was invoked from this workspace.

## Ada result

Fresh read-only collection: 40 records, 41/41 agenda items accounted for, 0% record pass rate, 66 exceptions and **go-live withheld**. Exceptions comprise 38 failed source-link checks, 27 incomplete document privacy reviews and one uncertain legacy case identity. A generic HTTP-200 application shell is not accepted as a case deep link. Privacy-held documents and unverified application links are omitted from the snapshot. Unavailable location facts remain explicitly unavailable. No missing outcome, impact or deadline was invented.

The disabled `sample-escribe` entry uses recorded eSCRIBE fixtures and the same command: 4 records, 100% pass, no exceptions, go-live false because it is disabled. It renders in the same local preview without changing code or environment per area.

## Verification

Node 24.18.0: 720 tests in 147 files; TypeScript passes; ESLint has zero errors and four existing warnings. The optimized hosted-semantics Preview build passes with `VERCEL_ENV=preview`, `VERCEL=1`, no database variables, and no `LAW_SITE_REVIEW_AREAS`. Its static client scan passes (39 files).

Local Playwright screenshots: [capture manifest](screenshots/2026-10-31-ada-county/README.md). Both 1440x900 and 390x844 cover map, expanded list, four representative projects (including agenda-only and appeal), read-only queue and Boise 404, plus the disabled sample. Rendering caused no JavaScript errors or database reads. Visual review corrected overbroad redaction of ordinary words and the inherited hardcoded timezone label. Remaining source/privacy/location gaps stay visible in review and withheld from publication.

No production writes, paid development AI, local-file deployment, protection changes or merge.
