# Onboarding implementation log

Branch: codex/jurisdiction-onboarding. User brief: attached 2026-10-27-jurisdiction-onboarding-boise-ada.md.txt.

Scope: reusable registry/platform onboarding first; Boise and Ada admin-only second. Never publish either. Keep live email approval intact.

Completed: initial audit; generated, validated nine-file registry; platform adapters and compatibility bridges; bounded cached HTTP; private staging and promotion approval; deadline engine; transactionally enforced AI budgets; CLI; protected admin map/project previews and image controls; reversible migrations; source fixtures and regression tests.

Validation: 541 tests in 104 files pass, including unchanged seven-area manifests, the legacy source client, existing public-page tests, recorded source contracts, nested agency library discovery, promotion approval, document-hash deduplication, bounded page-image OCR, packet exclusion and atomic multi-bucket budgets. Typecheck and Git-built Vercel previews pass. Full lint passes with four existing unused-variable warnings; existing internal-link errors in four admin pages and an unescaped apostrophe on Contact were corrected without changing their content.

Source collection: Boise 267 active applications, 45 meetings, 103 case items; Ada 110 recent or hearing-linked PZ applications, six meetings, 92 case references. Initial bounded collections completed; the latest Boise refresh retained deferred meeting work for the next run. Ada tentative dates remain separate from confirmed agendas. Oversized reports and compiled packets are excluded. Boise has no application geometry or received date in the active table; neither is invented. Ada county geometry excludes incorporated cities. Older hearing-linked active records are retained, with unambiguous parcel/address fallback matching. Historical cases missing from the active source remain unmatched; a targeted historical-record lookup is not implemented.

Runtime results: eSCRIBE per-item PDFs return Cloudflare HTTP 403 from both local ingestion and the Git-built Vercel preview. No bypass was attempted. Boise iQM2 and Ada PDFs download successfully. Each jurisdiction has five existing-pipeline AI samples. Measured spend: Boise $0.0494172, Ada $0.0282872. Boise also retains $0.0055752 reserved for uncertain failed image calls. Every sample invocation stayed below $1. Remaining report appendices are explicitly deferred. Records and images preserve official source links and physical pages.

Ten sampled private project pages render the six questions, As-of stamps, reporting links, official sources and image/context fallbacks. Public Boise/Ada pages return 404 and their URLs are absent from the sitemap. Map visual review remains an explicit checklist, not a claimed screenshot review.

Delivery: PR #6, https://github.com/51Magnum/local-agenda-watch/pull/6. QA Markdown and JSON are in reports/jurisdictions. Boise and Ada remain admin_only; neither has an admin publication approval. Nothing was merged to main or deployed to production. Only Git-built previews were used. Production-runtime source access is not verified. Council's configured transition date is 2027-01-12; HPC's exact transition remains unverified.

The preview uses branch-scoped admin credentials saved only in ignored output/jurisdictions/preview-credentials.json in the owner's workspace (username admin, REVIEW_ADMIN_PASSWORD entry). Production credentials and enabled email delivery were not changed.
