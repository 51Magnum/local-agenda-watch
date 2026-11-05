# Publication state and explicit resume

Passing QA and public display are different states. A durable `paused` publication stays paused through collection, self-checks and deployments, even when its self-check passes. The previous admin pages had Pause but no Resume action, and the workflow printed only `goLive`, which made that state difficult to diagnose.

The admin Jurisdictions and Review pages now show actual publication state, eligible record count, self-check status, and a plain-language reason. Paused areas offer **Resume publication** with the existing admin confirmation. The button is disabled unless current staging, its passing self-check and recorded approval match the committed review. The server repeats all those guards inside a transaction. Preview cannot resume or write.

The existing **Refresh configured jurisdictions** workflow now prints private operational status after its checks: `status`, `publiclyVisible`, `checksPassed`, `canResume`, `publishedRecords`, and the reason. It logs no source prose, applicant identity, account details, credentials or pin locations. An authenticated `command=status` reads that metadata without running migrations, collection or other writes.

An explicit owner-requested workflow run can set `resume_area` to a registry-enabled onboarding area. The default is blank: ordinary schedules, merges and manual refreshes never clear a pause. A resume run only processes the chosen area, performs fresh collection and checks, and refuses resume if either phase fails. It uses the existing GitHub authentication and cron secret; no new deployment settings or services are needed.

After checks or a successful resume, the app updates approved map data and expires the area's map/index tags, resident routes, sitemap, home-map metadata and coverage boundaries. This avoids retaining a pre-launch 404 or an outdated map index after publication changes. Withheld records are never added to the public projection.

Validation on Node 24: 947 tests in 174 files, typecheck and build pass, lint zero errors/four pre-existing warnings. Eight desktop/mobile browser checks use an isolated PostgreSQL fixture: passing-but-paused state is explicit; cancelling confirmation writes nothing; confirming exposes approved records; public hub and coverage update. Additional local API checks confirm Ada appears in home-map metadata with exactly 38 eligible cases. No real production database, email or AI is used for those checks.

No publication is automatically resumed by this change. Production status must be read from the protected workflow or admin page; an intentional pause requires an explicit owner/admin resume action.
