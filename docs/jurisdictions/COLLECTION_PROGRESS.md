# Resumable jurisdiction collection

Collection saves successfully fetched agenda meetings in a private work table, separate from staging, QA and publication. On an unfinished pass the previous staged/published data stays intact. Later passes re-list the official calendars, fetch pending or changed meetings, and reuse details already verified within that bounded cycle. Configuration/range changes or a two-hour expiry reset the cycle. Completing staging clears the checkpoint; the next scheduled refresh starts fresh.

A five-minute renewable lease prevents overlapping collectors; an expired lease can be reclaimed and a stale worker cannot overwrite its successor. Checkpoints are written every five fetched meetings and at source/pass boundaries. The existing automatic migration runner creates the table idempotently; the migration includes a down file. No manual schema, environment, role, secret or service setup is needed.

The Git workflow permits four bounded collection passes. It runs the normal self-check only after `complete: true`. Exhausted partial passes retain their private checkpoint and fail without advancing QA. Access-blocked sources stop immediate retries; there is no challenge bypass. Existing document discovery, privacy, snapshot-comparison and publication gates remain in place. Finishing collection alone does not approve Boise for publication.

Node 24 validation:

- 955 tests passed in 178 files; typecheck and production build passed. Lint: zero errors, four existing warnings.
- Regressions cover partial-to-complete collector integration, source failures, changed meetings, cycle expiry, durable progress, concurrent collectors, stale leases, Preview write refusal, idempotent migration and rollback.
- Two offline executions of the actual workflow shell verify completion on pass three triggers exactly one self-check, while four incomplete passes trigger none.
- Read-only official Boise agenda proof: pass one (short 45-second budget) completed 15 meetings with 30 pending; pass two resumed and completed all 45 meetings, zero pending and zero source failures. Checkpoints stayed in ignored local output; no production database, email or AI was used.
