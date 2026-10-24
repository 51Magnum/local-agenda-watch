# Case timelines across live areas

Discovery covers every live area configured in the jurisdiction registry. Braeburn Creek remains the reference project. The application remains a developer proposal until reviewed final-decision evidence exists for both cases. No decision-letter result or applied date is pre-seeded or inferred from a staff report.

## Production setup: Neon + Vercel

1. Create/select a Neon database. Copy its **pooled** connection string (pooler hostname, sslmode=require) to the Vercel project's server-only DATABASE_URL variable. Do not commit the connection string.
2. Configure server-only OPENAI_API_KEY, OPENAI_EXTRACTION_MODEL, REVIEW_ADMIN_PASSWORD, and CRON_SECRET in the same Vercel project. Use independent, long random secrets. No secret uses a NEXT_PUBLIC_ prefix. The default extraction model is gpt-4.1-mini; change it to another model supporting Structured Outputs and PDF inputs if desired.
3. TIMELINE_CASE_IDS defaults to *: every active, upcoming, and unresolved case across live jurisdictions. A comma-separated case allowlist is optional. Discovery uses area-specific official hosts and document-label rules in the registry.
4. Deploy. The first ingestion initializes the law_evidence JSONB table automatically; the database role needs CREATE TABLE permission initially. This pilot uses one transaction-locked document/evidence snapshot. Runs remain bounded; monitor JSONB snapshot size as the document archive grows and partition storage before large-volume national coverage. Neon provides durability; do not use Vercel's local filesystem for evidence.
5. The hourly schedule is in .github/workflows/case-timeline.yml (17 minutes past each hour). Add a GitHub repository Actions secret CRON_SECRET with the same value as the Vercel variable. The workflow calls /api/cron/case-timeline with Authorization: Bearer CRON_SECRET; it pauses harmlessly until that repository secret exists. GitHub schedules can be delayed; use workflow_dispatch for a manual refresh. An overlapping worker returns 409; a missing API key returns 503. The worker runs on Vercel with a 300-second limit. This supports hourly scheduling without changing the Vercel cron plan. Do not enable a second scheduler for the same worker.
6. Visit /admin/review. The browser requests HTTP Basic authentication: username admin, password REVIEW_ADMIN_PASSWORD. All admin pages/actions are protected; no credentials are shown in pages or logged. The admin is excluded from indexing. Mutating review requests also require a matching Origin.
7. Validate the actual P&Z decision letter against its quoted source, then approve pzResult and any vote separately. An approved P&Z recommendation does not approve the development.

## Local use

Copy .env.example to .env.local and supply your private configuration there. Local secrets may already have been generated in the ignored .env.local. With no DATABASE_URL, local development uses the ignored .data/timeline.json store with serialized atomic writes. The app refuses this fallback on Vercel.

- npm run timeline:sync -- --discover-only: refresh city records and agenda appearances without PDF fact extraction. Scanned PDF-only agendas may still require the configured OCR API key; failures are logged.
- npm run timeline:sync: run the full worker, using the same lease/cache/review rules as cron.
- npm run dev -- --port 3010: preview /us/id/nampa/braeburn-creek and /admin/review. Restart after changing environment variables.

## Sources and missing records

EnerGov contributes ApplyDate, PlanStatus, an explicit LastActionDate when supplied, and the attachment list. CompleteDate is not substituted for a last-action or decision date. Secure/offline attachments are ignored. Direct FilePath links are used only if they belong to the official host allowlist. Portal-mediated documents without a verified direct URL are listed as ingestion warnings; no download endpoint is invented.

PrimeGov discovery checks current/past meeting indexes, HTML agendas and PDF-only agendas, matching full case IDs. Agenda appearances are stored separately from explicitly scheduled hearings: authorizing a future hearing is not a decision. Published PDF minutes are preferred; HTML minutes have source links without invented PDF page numbers. Lists and source failures are logged, not interpreted as an empty history. Discovery has a time budget; the worker retries on the next run.

If a publicly listed decision letter cannot be fetched directly, add its verified official URL to TIMELINE_SOURCE_REGISTRY (JSON format in .env.example). This registry supplies URLs and case associations only; it cannot inject decisions or bypass extraction/review. The worker also uses the project's existing official staff-report source registry.

## Processing and publication rules

- Document failures wait 24 hours between attempts. At three failures the version becomes failed-permanent and stops AI work. /admin/review lists these documents with an authenticated, same-origin Retry action; retries are audited. Changed SHA-256 bytes automatically reset the limit. Blocked hosts and time-budget deferrals do not consume failures.
- Token usage from each API response is checkpointed immediately into the durable run log, including incomplete responses. Per-area discovery counts, extraction completions, and worked/blocked/unavailable hosts appear in review and the protected cron response.
- Agenda OCR text is checkpointed before agenda matching or processing another document. Discovery library queues and per-area case cursors resume across runs. Upcoming/newest cases are prioritized, and extraction interleaves areas.
- SHA-256 hashes identify document versions. Each version caches physical-page text. Unchanged completed versions skip extraction, OCR, and AI. Shared reports are transcribed once, with case-specific field extraction.
- Native PDF text extraction uses unpdf. Pages with little/no embedded text use PDF visual transcription as an OCR fallback, retaining physical page numbering. OCR-derived fields always require review, even at high confidence. Native text is cached before OCR; successful OCR text is cached before fact extraction. Failed jobs resume completed case extractions without repeating them.
- The worker limits PDFs to 45 MB / 200 pages, text inputs to 500,000 characters, and bounds source/API timeouts. Unsupported documents stay in the error list for retry/manual splitting.
- Structured extraction has a fixed field schema. Missing facts are null. Non-null PDF facts require an exact source quote on the cited physical page, a valid confidence, and a permitted value/date format. Document text is treated as untrusted data and cannot give instructions to the worker.
- Decision fields (P&Z result, Council decision, votes, decision date) always require explicit review. Public rendering independently enforces this even if a decision were accidentally marked auto_published. Staff reports cannot supply decision fields.
- Other native-text fields may auto-publish at confidence >= 0.95. Other candidates stay pending. Source URLs/page numbers and quotations remain stored with each candidate.
- Every edit, approval, and rejection is audited against the exact hash. A changed source invalidates previous evidence until that new version is processed/reviewed. Temporary download failures retain previously verified evidence.
- Rejected candidates remain rejected on unchanged reruns. No field is approved merely because a case's raw city status says Approved.

## Operational limits

This repository does not contain production credentials. No live AI extraction, production Neon connection, or hourly run is confirmed until those settings are supplied and the deployment/worker succeeds. The tests use explicitly synthetic decision-letter fixtures; they are never public seed data. If EnerGov is blocked or a letter is absent, the public timeline leaves those facts unavailable and keeps outcomes pending.


## Braeburn report fallback and review dates

The verified shared September staff report has a conservative native-text fallback for the request, overall site-area table, detached-lot count, requested zoning, and road-frontage conditions. Each recovered field must still pass exact-quote and physical-page validation. It supplies no recommendation or decision. High-confidence native fields appear under **All current fields** in review; decision fields always remain pending until approved. A changed extraction version preserves the text/OCR cache for unchanged PDF bytes.

Under-review dates use only an explicit EnerGov ReviewDate or ReviewStartDate. Applied dates, last-action dates, and document posting dates are not substitutes. If neither explicit field exists, the date stays empty until a verified workflow source is added.

EnerGov PDFs without a direct URL use the official public FileDownloadService protocol: metadata requested with a FileID header, then ranged downloads using its temporary FileToken. Tokens stay in memory and are never stored or logged. Every download rechecks case ownership, public visibility, and the attendance-sheet filter. IsOnline describes upload origin rather than visibility. Source citations open the official attachment list and retain the physical PDF page label; the portal does not offer a direct PDF page link. Listing a document does not mean it has been processed: decision fields remain pending until the PDF is ingested and a reviewer approves them.

The shared September P&Z report uses the registered PrimeGov attachment as its canonical source. Its explicitly named EnerGov mirror is listed on case pages but is not downloaded a second time. The canonical PDF is still downloaded and hashed on each check, and new filenames remain discoverable.
