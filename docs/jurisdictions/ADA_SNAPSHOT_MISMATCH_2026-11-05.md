# Ada snapshot mismatch — November 5, 2026

## Confirmed cause

The launch gate reported 38 changed records even though the reviewed and live decisions both passed. Per-record `sourceHash()` used ordinary `JSON.stringify()` on captured source fields and geometry. PostgreSQL JSONB preserves those values but changes object-key order. The production workflow collects and saves staging in one request, then checks the database-loaded staging in another. Local snapshot generation checks the original in-memory object. Those equivalent objects received different hashes.

An isolated PostgreSQL JSONB round trip reproduced exactly 38 changed hashes among Ada's 40 cached records. The two agenda-only records had no captured source fields and did not change. No production credential or database access was needed for this reproduction.

## Fix and safeguards

Per-record source hashing now uses the existing recursive canonical content hashing also used for snapshot approval. Object keys are sorted; source values, array order, geometry coordinates, identities, record links and linked evidence still participate. The reviewed snapshot and redacted report were regenerated from official public sources on November 5. No pass threshold, drift allowance, privacy rule, pause switch, or approval requirement was relaxed.

Actual PostgreSQL integration tests cover the 38 false mismatches, unchanged publication after separate collect/check round trips, and refusal of first publication when four real source descriptions change. Nested source-value, geometry and link changes still invalidate the record hash. Existing tests continue to cover changed decisions, missing baselines, privacy and publication pause.

## Refreshed Ada review

- 40 retained records; 38 eligible for publication; 95% pass rate.
- All coverage checks pass. Go-live decision: approved by the self-check.
- Two source conflicts remain withheld: `202103209-S` has three distinct county query rows and `202300644-S` has two, with differing descriptions. LAW does not choose one conflicting row.
- The same fresh records and official-link evidence were checked after actual JSONB storage: zero changed record signatures, identical go-live decision, drift check passes.
- Snapshot privacy scan passes: no captured source fields, applicant identities, staff emails or contact fields are distributed. No AI calls were made.

The refreshed source includes a substantive update to `202601250-CU`: its county description now proposes a livestock confinement/animal feeding facility with approximately 7,428 animal units, replacing the earlier two-phase description of approximately 16,440 units. Three other source records have staff-assignment metadata changes; those private values remain excluded from the artifact. Record identities, mapped geometry, eligibility and individual check statuses are unchanged from the previous reviewed artifact.

The regenerated artifact also applies the already-merged resident-content policy: six descriptions containing legal parcel-description language are suppressed by that existing policy. This PR does not change that policy. The preview therefore shows the same content policy production will use.

## Deployment

This PR does not publish Ada directly. After the owner merges it, the existing Git deployment and automatic production refresh collect current data and run the gate again. If the current source matches this reviewed baseline within the existing allowance, Ada can publish automatically. Further material source changes or a pause will still withhold it and appear in `/admin/review`.

Validation: Node 24; 926 tests in 169 files; typecheck passes; ESLint zero errors and four existing warnings. The preview build runs with no database, AI or email credentials. Snapshot and reports are committed together. No production writes, paid AI, schema changes or new configuration are required.
