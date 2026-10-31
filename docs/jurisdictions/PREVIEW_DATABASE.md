# Isolated preview database

Preview requires DATABASE_URL_PREVIEW. Missing it, using the production URL, or using the production endpoint (including its pooled alias) is an error. There is no production fallback. Preview runtime sessions are read-only; subscriber delivery stays disabled.

## Neon setup for Shane

1. In the existing Neon project, create a branch named ada-preview from the intended baseline. Confirm its endpoint ID differs from production. Copy its connection details without committing them.
2. Using the branch owner, apply 20261027_jurisdiction_onboarding.up.sql if needed, 20261028_onboarding_constraints.up.sql, and 20261031_self_check.up.sql. Apply migrations through the database owner, never the preview runtime. These migrations are tested locally; this task has not applied them to Neon.
3. Create separate login roles, for example law_preview_reader and law_preview_writer, with unique passwords. Give the reader USAGE on schema public and SELECT on existing tables. Set its default_transaction_read_only to on. Grant default table SELECT privileges from the migration owner for future tables.
4. Give the writer USAGE on public and SELECT/INSERT/UPDATE/DELETE on onboarding snapshot, QA, approval, publication, exception/decision, and AI budget/call tables. Grant access to existing global AI ledger tables only if AI is intentionally enabled. Do not give the writer schema creation or migration privileges. The writer belongs only in the maintenance shell, never Vercel runtime configuration.
5. Set Vercel Preview DATABASE_URL_PREVIEW to the reader's ada-preview URL. Keep DATABASE_URL as the production comparison baseline; it is never selected by preview. Set the protection bypass secret in the screenshot runner's environment, not Git. Redeploy through the Git integration after configuring these variables.

## Populate the isolated branch

Use Node 24. Set LAW_DB_TARGET=preview and DATABASE_URL_PREVIEW to the writer's connection URL for this maintenance session. Keep DATABASE_URL available solely for endpoint comparison. Set DATABASE_BRANCH_ID and DATABASE_PREVIEW_BRANCH_ID to the actual Neon branch IDs copied from the console; endpoints alone cannot distinguish two computes on the same branch. The CLI requires distinct branch IDs. Do not set VERCEL_ENV=production.

```powershell
$env:LAW_DB_TARGET = 'preview'
# Inject DATABASE_URL_PREVIEW for the writer through your secret manager.
npm run law:jurisdiction -- check ada-county --dry-run --collect
npm run law:jurisdiction -- backfill ada-county --write
```

The CLI prints the endpoint/database with credentials redacted before writes. A completed backfill runs record checks, stores exceptions, and records automatic publication approval only when the configured pass rate and all coverage checks pass. Incomplete collections never replace staging. Failed links and incomplete document privacy reviews remain exceptions.

The Vercel runtime continues using the reader role. Do not copy the writer URL into its environment. Deploy only through Git; never upload a local working directory or local build. PR #7 remains Shane's merge decision.
