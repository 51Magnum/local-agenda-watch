# Add a jurisdiction

The registry owns source configuration and publication eligibility. Current approved jurisdictions keep their existing parsers and public behavior. Boise and unincorporated Ada County are **admin-only**, even when ingestion is enabled. Do not enable either publicly as part of this task.

## Checklist

1. Research official application, hearing, document and GIS sources. Verify the planning authority separately from postal city. Capture the official participation rules and revision dates. Never bypass authentication, CAPTCHA or an access challenge.
2. Copy a compatible file in `lib/jurisdictions/registry/` to `<slug>.json`. Use a platform adapter that matches the actual source. Keep `launchStatus: admin_only`, choose a distinct AA badge color, set dollar/byte/token caps and official source hosts. For counties configure city-limit subtraction. Missing facts stay missing.
3. Run `npm run law:jurisdiction -- validate <slug>`. Review endpoint status, latency and blocked results. Inspect one meeting and one per-item attachment. A 200 response containing a challenge is blocked, not successful collection.
4. Run `npm run law:jurisdiction -- backfill <slug> --days 90 --dry-run`. Then repeat with `--write` to save private staging. Repeating this command updates the jurisdiction snapshot rather than inserting duplicate projects. It does not call OpenAI.
5. With server-only OpenAI and database configuration available, run `npm run law:jurisdiction -- sample-ai <slug> --n 5 --max-usd 1.00`. The existing extraction/review pipeline is reused. Dollar limits are reserved transactionally before each provider call; global daily, jurisdiction monthly, backfill and sample ceilings all apply. Oversized/blocked documents remain recorded as deferred. Never supply an entire compiled packet for AI.
6. Run `npm run law:jurisdiction -- qa-report <slug>`. Read both files under `reports/jurisdictions/`. Review case joins, unmapped cases, sources, attachment skips, source-backed AI outputs, spend, upcoming participation dates and the map checklist. Estimated monthly cost is explicitly an estimate.
7. Open `/admin/jurisdictions` in the Git-built preview. Compare the private boundary, cases and full project previews with official records. Check that county coverage excludes cities and that city-impact areas do not change the responsible authority. Every source image must retain its official document/page and privacy review. Confirm upcoming meetings and per-body platform cutovers. Record a Vercel document download check; a local success does not establish datacenter access.
8. Move between private stages with `npm run law:jurisdiction -- promote <slug> --to qa` or `--to admin_only`. Public promotion is refused unless the **current snapshot** has a passing QA report and an authenticated admin approval stored in the database. Admin approval does not itself publish. After approval, `promote --to public` updates the registry file; commit it, pass the PR checks and deploy through Git to publish.

Do not put credentials in registry files or reports. The CLI intentionally does not load `.env.local` automatically or copy production secrets. Local hard-fact work can use ignored `.data/jurisdictions` files; AI budgets and public approval require the durable database. Use normal environment injection for a configured runner. On Vercel, use the authenticated admin operations or `/api/cron/jurisdictions`; the latter requires the existing cron credential.

## Config-only example on an existing platform

For a second eSCRIBE jurisdiction, copy `boise.json` to `example-city.json`, replace identity, color, official boundary/GIS URLs, hearing bodies, source hosts, field mappings, record URL template and participation rules. Keep only that city's eSCRIBE agenda source; remove Boise's migration windows and iQM2 source unless verified for the new city. The ArcGIS application adapter supports attribute-only tables as well as polygon layers. Set `enabled: true`, `launchStatus: admin_only`, `sourcesVerifiedAt: null` until validation is recorded. No route, sitemap, alert filter or parser should be edited for a new instance of a supported generic platform.

The build, dev server, tests and CLI automatically regenerate `lib/jurisdictions/generated.ts` from the registry directory. Commit the generated manifest with the new config for reviewers; `npm run jurisdictions:generate` regenerates it manually.

Legacy source families retain compatibility bridges. Before claiming that a new source matches one of those families, run its recorded-fixture contract and validation. A vendor name alone does not establish identical page semantics. Unsupported variants fail closed and must acquire a reusable platform implementation and contract fixtures before onboarding.

## Boise

- eSCRIBE and iQM2 are configured per body and date. Council remains on iQM2 until 2027-01-12; P&Z/Examiner start on eSCRIBE 2026-10-05 and Design Review on 2026-10-14. The brief did not establish HPC's exact cutover; retain both archives and deduplicate rather than inventing a date.
- The zoning-activities layer is a **table**. Use `StatusCategory = 'Application in Review'`, not a comparison against `Status`. It has no parcel geometry or received-date field. Do not use `CRCompleteDate` as a filing date. Child records join PLN inventory to CAR/SUB/CUP/DRH agenda references.
- Never download full eSCRIBE packages or iQM2 Type=1 packets for AI. Test per-item reports separately from meeting pages. If eSCRIBE files are blocked, retain the agenda facts and document links, record the block, and leave extraction pending.
- Written testimony and sign-up are separate rules; use the linked city event page for the actual meeting sign-up. Examiner sign-up time differs from the other bodies.

## Ada County

- Use `DS_Agendas`, not the general `BOCCAgendas` archive. The file tree embeds public JSON data; do not execute its scripts. Dates come from agenda filenames, not inconsistent folder labels.
- Filter application inventory to `AppDivision='PZ'`. The live layer has parcel IDs and polygons but no address field. Keep missing addresses explicit.
- County coverage is the official county polygon minus **all** incorporated city-limit polygons. A city impact area does not transfer the case to a city.
- “Close of business” does not establish a clock time. Until verified, show the Thursday date plus the qualified COB wording. Monday remote-registration cutoff similarly remains date-only if the hour is not established. Tentative schedule rows are not confirmed case hearings.

## Costs and rollout

Boise starts with $15 backfill/$15 monthly caps and a conservative 60k per-document token bound; Ada with $5/$5 and the same document bound. Existing jurisdictions retain their prior model context/OCR allowance while acquiring monthly/backfill accounting. A blocked or failed request cannot silently release a reservation if provider cost is uncertain. Review reserved spend before retrying. The admin page shows spent and reserved amounts separately.

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` before release. Roll back only the onboarding tables with `20261027_jurisdiction_onboarding.down.sql`, after exporting any approvals/spend history. Existing application/evidence tables are not dropped.

TODO, future only: an official-site discovery tool may draft registry files for human review. It must not automatically enable ingestion or publication. No discovery crawler is implemented here.
