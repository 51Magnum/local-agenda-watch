# Email alerts: approval, preview, and delivery

Standard new-watch confirmations, confirmed project/place digests, hearing reminders, and internal correction notices were owner-approved on October 27, 2026. All deployments must be sourced from GitHub through a reviewed PR; local file uploads to Vercel are prohibited. Preview subscriber delivery remains disabled. Waitlist re-consent and coverage announcements require separate owner approval.

## Approval controls

- `ALERTS_DELIVERY_ENABLED=true` is necessary for live subscriber and internal correction notifications. Live delivery additionally requires `VERCEL_ENV=production`; previews cannot send these messages even if the flag is accidentally true.
- `RESEND_API_KEY` and a nonempty `ALERTS_MAILING_ADDRESS` are required for any delivery, including an explicit admin test.
- Waitlist re-consent also requires `ALERTS_WAITLIST_CONFIRMATIONS_ENABLED=true`.
- Coverage announcements also require `ALERTS_ANNOUNCEMENTS_ENABLED=true`, a same-origin authenticated admin trigger, and the recipient's separate coverage-announcement opt-in. They do not run on the cron.
- The Actions schedule is every 30 minutes for retries and hearing reminders, with the workflow job gated by repository variable `ALERTS_DELIVERY_APPROVED=true`. The October 27 approval covers the standard categories above; separate campaign gates remain in place.
- The authenticated `/admin/emails/test` endpoint accepts exactly one explicit admin-entered address, builds the selected template on the server, adds `[TEST]`, and uses inactive subscription links. It never reads a subscriber list. Owner-requested individual test sends do not enable automatic delivery.

Production delivery requires its approval gates and production environment. Preview subscriber delivery is always disabled, even when a flag is inherited. New emails omit the extra watch-management link; their unsubscribe link explicitly stops all alerts for the email address. Test emails label unsubscribe as inactive without a clickable dead link. The management route remains for links in older emails.

## Templates and preview data

`/admin/emails` provides nine examples: project and address confirmations, waitlist re-consent, project and address digests, a multi-project address digest, a hearing reminder, a coverage announcement, and an internal correction receipt. It includes desktop, 375 px mobile, dark, and plain-text views.

The gallery reads the live public pane endpoint for Braeburn Creek, Thruston Choi H-2026-0053, and CR2024-0010. This is the same project loader used by the live pane, avoiding stale asset identifiers in isolated preview databases. Saved-place examples and the correction report are illustrative and labelled; no real subscriber information or resident reports are exposed. Preview emails do not claim a new change happened today, and the reminder preview makes no false relative-date claim.

`lib/email/project.ts` builds public, privacy-protected snapshots. `lib/email/templates.ts` renders both HTML and plain text, including the six resident questions in order for every project block. The renderer uses presentation tables, inline styling, a text logo, system fonts, explicit button padding, and dark-mode hints. The combined decoded HTML and text budget is below 68 KB, leaving headroom for MIME encoding under 100 KB. Large digests are divided into parts in the **same recipient run**, with subject counts matching the blocks in each part.

## State, grouping, and retries

- Watches are matched against official map geometry and resolved through `projectDetail`; canonical lead-project URLs group aliases and explicitly merged city/county sites. One person is selected as a batch, then all their watches are read. The 250 limit applies to people, not watch rows, with a fair last-checked rotation.
- Version 2 snapshots retain previous hearing, status, decision date, documents and hashes, history, location, and participation instructions. Legacy hash-only state establishes a baseline without inventing a change.
- Digests compare structured official status/date, hearing details, agendas/packets, sourced deadlines, new document URLs and known content hashes. Generated headlines, location wording, history labels, instruction wording, document renaming, and a hearing merely aging out do not trigger delivery. Cosmetic differences still advance the stored baseline silently. A newly discovered closed case is baselined rather than announced as a new nearby project; subsequent real record changes remain eligible.
- Explicit official approval/denial/withdrawal replaces generic missing-outcome history labels in the shared pane and email. Historical decisions stay under “What’s happened”; “What’s next” shows a verified future hearing or explains that none is verified. Subjects describe a record update rather than announcing an old decision as new.
- Unsent queued digests carry alert policy version 3. Messages from earlier policies are cancelled and rebuilt against the existing watch baseline before any send.
- `law_alert_deliveries` stores the rendered payload and per-part progress before sending. Stable idempotency keys protect retries. State and sent status advance together in a transaction only after successful delivery. Failures remain queued with backoff and do not stop other recipients.
- Queued project messages are revalidated against current public snapshots and deadlines before delivery. Changed records are cancelled and rebuilt. A reminder is sent only two local calendar days before a verified upcoming hearing and expires after that delivery window.
- Withdrawn/closed cases and passed hearings are not presented as upcoming. Expired comment deadlines suppress submission invitations while retaining the official record. Residential names, exact addresses, images, and private document titles are withheld by the shared privacy policy.
- Correction notifications are restricted to `corrections@localagendawatch.com`, queued only after approval, and have their own unsubscribe-capable internal subscription. They identify the report as unverified.

## Verification

Run `npm test`, `npx tsc --noEmit`, targeted ESLint, and a production-mode build before deployment. Regression coverage includes previous-value diffs, canonical deduplication, subject counts, name scrubbing, timed deadlines, withdrawn cases, size splitting, test-recipient authorization, the cron approval gate, and a PGlite batch containing **251 watches for one recipient plus a second recipient**, including provider failure and successful retry without losing state.

The local review artifact at `output/email-preview/index.html` contains 36 screenshots, all nine HTML/text pairs, and offline `.eml` files addressed to `preview@example.invalid`. Browser checks cover 375 px overflow, action-button height, alt text, image loading, dark colors, and gallery controls. Actual Gmail, Outlook, and Apple Mail inbox rendering is not claimed without an approved test send; the offline `.eml` files support local client review without sending.


## Continuations and alert accuracy (November 10, 2026)

The data path is: jurisdiction adapters (`lib/sources`, `lib/localities`) -> case feeds and map records -> shared `projectDetail` pane -> `emailProject` snapshots -> `projectDiff` / `loadWatchProjects` -> templates -> durable delivery queue. Case numbers are already separate source fields (`appId` / `recordId`); email snapshots now retain all explicitly related case numbers and the case-specific official record URL.

- Explicit “continued to/until” notes create a date-only hearing with the original notice as provenance. The old event remains in history. No old agenda, time, or deadline is copied. Both Nampa ingestion and scheduler indexing normalize these events, including older cached feeds. Requested continuances and invalid dates do not establish a hearing.
- Related-case hearings follow explicit official IDs, including municipal combined applications and PP/PUD children; names and proximity do not establish a relationship.
- Snapshots retain raw official status for material diffs plus `normalizedStatus`: `upcoming_hearing`, `hearing_passed_decision_pending`, `approved`, `denied`, `withdrawn`, `closed`, or `under_review`. The last value is necessary for active applications without a hearing. An intermediate approval does not cancel a verified subsequent hearing. Final/closed records cannot invite participation. Day comparisons use America/Denver; timed events compare instants.
- New/legacy watches establish a baseline. Newly discovered terminal cases are baselined. `sourceVersions` tracks configured application and agenda sources; a changed source establishes a fresh baseline for that area. Existing watches acquire this metadata silently; previously unseen active projects are not announced until a source baseline exists. Generated copy, location cleanup, renamed documents, and time passing do not create updates. Official status/decision dates, hearing changes, sourced deadlines, new/revised documents, and published agenda/packet changes do. Digests put future hearings first, new cases next, then other record changes and decisions.
- HTML and plain text both show case numbers and comment references, hide test/internal place labels, omit internal role labels, suppress expired participation instructions/deadlines, and exclude computed density on mixed-use projects. Summaries use the shared website model.
- Subscriber digest/confirmation builds check external official links with normal TLS verification, bounded redirects, HTTP 200 responses, and public HTTPS destinations. Failed links are logged as `[email-link]` and omitted from both MIME parts. A case record redirecting to a generic portal is also rejected. Unsent queued digests use policy version 3 and revalidate link availability before delivery; older queued policies are rebuilt. Link health does not itself trigger a subscriber update.

### Read-only dry run

```
npm run alerts:dry-run -- --watch <subscription-uuid> --date 2026-11-10
```

Reads the watch and current public project records in production scope by default (`--scope` can select another explicit scope). The command forces `LAW_READ_ONLY=true` and disables mail before constructing any pool. All database connections enforce `default_transaction_read_only=on`; schema initialization is skipped, source-cache saves are disabled, and the command verifies PostgreSQL reports read-only transactions. Framework read caches are bypassed so the CLI can execute outside a Next request. The requested date is noon America/Denver for date comparisons; this is an evaluation of current records, not a reconstruction of a historical database. Optional `--output output/alerts-dry-run` changes the local output directory. It prints/writes each case number, normalized status, next hearing, inclusion reason and link-check result, plus HTML/text files for eligible updates. It never calls the queue or mail provider, advances subscriber state, or exposes recipient addresses/tokens. Source loaders may fetch public records but cannot persist refreshed production caches. Reports include automatic flags for missing case numbers, contradictory statuses, expired action copy, and failed/omitted links. No real emails are needed for verification.

### Source limits

Nampa notices may provide a continuation date before an agenda/time exists. Eagle tracker times have ambiguous timezone metadata, so only published calendar/agenda times are usable. A generic Eagle ArcGIS experience or Nampa PrimeGov portal is not a case-specific record; use an actually matched official agenda, case page or case document when available, otherwise omit the record link. Blocked Meridian WebLink/notices cannot supply a reliable fresh case-specific link; retained verified records remain dated evidence, not proof of a new successful check. The November 10 local build encountered HTTP 403 on Meridian notices and retained the previously verified notices. Link checks establish HTTP/TLS availability, not the truth or completeness of the document, and cannot bypass login or browser challenges.
