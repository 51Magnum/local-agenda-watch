# Ada County owner review and launch checklist

PR #7 remains unmerged. Ada County and Boise remain `admin_only`. This checklist does not record approval. Do not promote from a preview or change registry publication fields by hand.

## Measured review evidence

Read [fresh dry-run QA](../../reports/jurisdictions/ada-county-2026-10-28-dry-run.md) and its JSON. On October 28, 2026 the read-only collection retained **34 projects**, with **0 duplicate project numbers**, **23 hearing-linked projects**, **1 protected residential project**, and all **8 previously missing heard projects** with dated official history. There were 87 projects before hearing scoping; 53 staff-level records were excluded. Application matching is 35/41 hearing items (85.4%).

The earlier review snapshot had 99 distinct APPFILE records, 15 duplicated project numbers (18 extra records), 3 hearing-linked records and 3 privacy-detected records. Fewer protected projects now remain because staff records were excluded; privacy rules were not relaxed.

The fresh dry-run used **$0 in AI**, has no new AI sample or Git-runtime download verification, and was **not written to staging or durable QA**. It cannot authorize promotion. The [October 27 redacted QA](../../reports/jurisdictions/ada-county-2026-10-27.md) records five historical Ada samples costing **$0.0282872**. Do not call those a fresh sample. Reuse is valid only when official source hashes still match.

## Prepare the review environment

- [ ] Review the PR and its Git-sourced preview checks. Any merge of this hardening PR is Shane's decision; neither jurisdiction becomes public through this PR.
- [ ] Apply the onboarding migration and the additive `20261028_onboarding_constraints.up.sql` repair to the intended database with the migration owner. Never apply migrations from a preview runtime. The repair has a matching down migration and preserves data.
- [ ] Prefer a separate Neon preview branch/read-only role and configure `DATABASE_URL_PREVIEW` in Vercel Preview. See [preview database setup](PREVIEW_DATABASE.md). No separate Neon branch or role was provisioned or verified by this task. Until configured, application-enforced read-only sessions protect inherited database reads; preview signups require an isolated DSN.
- [ ] Populate fresh private staging through an authorized production maintenance environment after the owner approves the code. Preview admin mutations and **all** preview cron routes deliberately return 403. Do not override a preview's environment to enable writes.
- [ ] Confirm the review site is reading that fresh staging snapshot before signing off on the cases below. A preview that still reads the earlier 108-row snapshot is not proof of the new collection. The checked-in dry-run report is fresh evidence, not a deployed staging update.
- [ ] Keep preview subscriber delivery disabled. Approved normal production email delivery remains enabled; this does not authorize a campaign or coverage announcement.

Maintenance commands below assume an already authorized production maintenance shell with the intended `DATABASE_URL` and production runtime configuration. They deliberately refuse in a preview/default development environment. No credentials belong in Git.

```powershell
npm run law:jurisdiction -- backfill ada-county --days 90 --dry-run --report
npm run law:jurisdiction -- backfill ada-county --days 90 --write
npm run law:jurisdiction -- sample-ai ada-county --n 5 --max-usd 1
npm run law:jurisdiction -- qa-report ada-county
```

Run the authenticated production admin **Runtime check** as well, then regenerate QA. It must record the actual Git deployment SHA and successful official PDF checks. Cached samples must have current document hashes; an unavailable/oversized/blocked source remains deferred, not silently approved. Large native report sampling is tested locally, but actual 53–135 MB Vercel processing remains unverified.

## Review eight representative project pages

Open the [normal-site review](https://ada-review.localagendawatch.com/) while signed into the Vercel account. The hostname must point to the verified Git preview. Check all six resident questions, attribution, source links, dates and expanded details. Confirm the mobile pane stays concise.

| Case | Review |
| --- | --- |
| [202601398-CU-MSP](https://ada-review.localagendawatch.com/us/id/ada-county/plan/202601398-CU-MSP) | One contractor-yard project, October 15 history; no memo/findings filenames as title. |
| [202601614-VAC-PCON](https://ada-review.localagendawatch.com/us/id/ada-county/plan/202601614-VAC-PCON) | One vacation/consolidation project; October 14 BOCC history. |
| [202601395-CU-MSP-ALT](https://ada-review.localagendawatch.com/us/id/ada-county/plan/202601395-CU-MSP-ALT) | ALT source row links to October 15 combined agenda case. |
| [202600638-ZC-DA-S-V](https://ada-review.localagendawatch.com/us/id/ada-county/plan/202600638-ZC-DA-S-V) | Older filing retained with dated BOCC history and source attribution. |
| [202601753-CU](https://ada-review.localagendawatch.com/us/id/ada-county/plan/202601753-CU) | CU/HD/MSP source rows form one project; parcel geometry is combined. |
| [202600273-ZC-S-PUD-MSP-PR-HD-ALT](https://ada-review.localagendawatch.com/us/id/ada-county/plan/202600273-ZC-S-PUD-MSP-PR-HD-ALT) | Older multi-suffix project retains August, September and October hearings. |
| [202103209-S-TE](https://ada-review.localagendawatch.com/us/id/ada-county/plan/202103209-S-TE) | S source component matches S-TE despite sibling HD; old filing and actual hearing dates retained. |
| [202600934-AC](https://ada-review.localagendawatch.com/us/id/ada-county/plan/202600934-AC) | Protected residential-use example: generic activity title, approximate area, no exact street number, private applicant identity or parcel outline in feed/map/page. |

- [ ] Compare the unincorporated map clip with official county/city boundaries: mostly-city parcels excluded, eligible county parcels retained, missing geometry unverified.
- [ ] Check **What's next / How can I act** with no confirmed hearing: dated no-hearing message, official hearings/notices links, no signup or computed deadline.
- [ ] Check the recorded confirmed-hearing fixture (PZC October 15 / BOCC October 14, both 6 PM). A live future project must have its own published agenda before signup/deadlines appear. The current snapshot has no confirmed future project hearing; never present a calendar hint as that project's hearing.
- [ ] AI prose is visibly labeled and source-backed; private/uncertain applicant candidates require actual review. Unverified findings remain unknown.
- [ ] Confirm preview response `X-Robots-Tag: noindex, nofollow`, `/robots.txt` disallows `/`, metadata is noindex/nofollow and Ada canonicals use the preview hostname.
- [ ] Confirm a preview admin mutation and cron request return 403 before work starts; production counterparts retain normal authorization.
- [ ] Check [Nampa Braeburn Creek](https://ada-review.localagendawatch.com/us/id/nampa/braeburn-creek): unchanged project content and live packet extraction. After owner production deployment/run, verify the workflow reports completed and `sweeps.nampa.lastSuccessAt` advances; the page's **Last checked** must show that successful time. An incomplete sweep correctly retains the earlier success with a warning.
- [ ] Boise stays private. Its read-only source check found 257 current records: 154 polygons, 93 unique address points and 10 unmapped (96.1% located). No public Boise rollout is included.

## Record approval, then promote through the normal gate

Only proceed after fresh durable QA passes and Shane has reviewed the actual staged site. These commands use the existing authenticated `approveQa` route; `curl.exe --user admin` prompts for the password without putting it in the command. Use production administration, **not the preview hostname**.

```powershell
curl.exe --fail --show-error --user admin --output output/ada-owner-qa.json https://www.localagendawatch.com/admin/jurisdictions/ada-county/report
$adaQa = Get-Content -LiteralPath output/ada-owner-qa.json -Raw | ConvertFrom-Json
if (-not $adaQa.passed -or $adaQa.id.StartsWith('dry-run-')) { throw 'Current durable QA is not passing' }
curl.exe --fail --show-error --user admin --header 'Origin: https://www.localagendawatch.com' --form-string 'areaId=ada-county' --form-string "qaId=$($adaQa.id)" https://www.localagendawatch.com/admin/jurisdictions/approval

# In the authorized production maintenance environment, after recorded owner approval:
npm run law:jurisdiction -- promote ada-county --to public
npm run jurisdictions:generate
npm test
npx tsc --noEmit
npx eslint .
npm run build
```

The normal promote command rechecks current passing QA plus its recorded approval before updating config. Do not hand-edit `launchStatus`/`publication`. Put the owner-approved generated config/boundary changes in a new Git branch and PR, verify its Git-sourced preview and required checks, then merge only with Shane's approval. Remove any obsolete branch-scoped review-only flag if the area is now public. Vercel production must build the merged Git commit; verify its Git SHA equals `origin/main`. Never upload a working directory or promote a locally sourced deployment.

Nothing in this checklist was executed as approval or promotion by Codex.
