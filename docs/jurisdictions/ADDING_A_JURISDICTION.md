# Add a jurisdiction

1. Add a registry JSON entry using existing adapters, verified official sources and the existing self-check configuration.
2. Run `npm run law:jurisdiction -- check <area> --dry-run --collect` on Node 24. No paid model is used. Inspect the report and exceptions.
3. Commit the config, `data/review/<area>.json` and generated reports; open a PR.
4. Look at the Git-sourced Vercel preview. Snapshots marked `review` are selected automatically. All review records are redacted and labeled; eligibility and the go-live decision remain visible. Subscriptions and admin writes are unavailable.
5. Merge when satisfied. The production refresh runs automatically after the merged Git deployment, applies idempotent migrations, collects again and runs the same checks. Publication requires the configured pass threshold, coverage checks, and agreement with the reviewed decision (at most three changed record identities, source hashes or check results). Material drift is withheld and queued in `/admin/review`. The pause switch remains effective.

No preview database, database roles, manual migrations, new Vercel variables or bypass secrets are needed. Local review: build and start with `VERCEL_ENV=preview`; no database variables. The disabled `sample-escribe` entry proves the same command using recorded eSCRIBE fixtures; it stays disabled in production.

Snapshots contain resident projections and redacted self-checks, never raw application fields. Unverified links, private contacts and documents held by the privacy check are omitted. Review visibility does not override production eligibility.
