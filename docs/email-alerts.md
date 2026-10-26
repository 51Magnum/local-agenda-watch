# Email alerts: approval, preview, and delivery

The email rebuild is deployed to a Vercel **preview only**. No live delivery is enabled by the implementation or deployment commands.

## Approval controls

- `ALERTS_DELIVERY_ENABLED=true` is necessary for live subscriber and internal correction notifications. Live delivery additionally requires `VERCEL_ENV=production`; previews cannot send these messages even if the flag is accidentally true.
- `RESEND_API_KEY` and a nonempty `ALERTS_MAILING_ADDRESS` are required for any delivery, including an explicit admin test.
- Waitlist re-consent also requires `ALERTS_WAITLIST_CONFIRMATIONS_ENABLED=true`.
- Coverage announcements also require `ALERTS_ANNOUNCEMENTS_ENABLED=true`, a same-origin authenticated admin trigger, and the recipient's separate coverage-announcement opt-in. They do not run on the cron.
- The proposed Actions schedule is every 30 minutes for retries and hearing reminders, but the workflow job is gated by repository variable `ALERTS_DELIVERY_APPROVED=true`. Do not enable that variable or production delivery until the owner approves this rebuild.
- The authenticated `/admin/emails/test` endpoint is the only preview delivery exception. It accepts exactly one explicit admin-entered address, builds the selected template on the server, adds `[TEST]`, and uses inactive subscription links. It never reads a subscriber list. No test email was sent during implementation.

Production has not been promoted as part of this work. Its existing deployed version is separate from these preview-only controls.

## Templates and preview data

`/admin/emails` provides nine examples: project and address confirmations, waitlist re-consent, project and address digests, a multi-project address digest, a hearing reminder, a coverage announcement, and an internal correction receipt. It includes desktop, 375 px mobile, dark, and plain-text views.

The gallery reads the live public pane endpoint for Braeburn Creek, Thruston Choi H-2026-0053, and CR2024-0010. This is the same project loader used by the live pane, avoiding stale asset identifiers in isolated preview databases. Saved-place examples and the correction report are illustrative and labelled; no real subscriber information or resident reports are exposed. Preview emails do not claim a new change happened today, and the reminder preview makes no false relative-date claim.

`lib/email/project.ts` builds public, privacy-protected snapshots. `lib/email/templates.ts` renders both HTML and plain text, including the six resident questions in order for every project block. The renderer uses presentation tables, inline styling, a text logo, system fonts, explicit button padding, and dark-mode hints. The combined decoded HTML and text budget is below 68 KB, leaving headroom for MIME encoding under 100 KB. Large digests are divided into parts in the **same recipient run**, with subject counts matching the blocks in each part.

## State, grouping, and retries

- Watches are matched against official map geometry and resolved through `projectDetail`; canonical lead-project URLs group aliases and explicitly merged city/county sites. One person is selected as a batch, then all their watches are read. The 250 limit applies to people, not watch rows, with a fair last-checked rotation.
- Version 2 snapshots retain previous hearing, status, decision date, documents and hashes, history, location, and participation instructions. Legacy hash-only state establishes a baseline without inventing a change.
- `law_alert_deliveries` stores the rendered payload and per-part progress before sending. Stable idempotency keys protect retries. State and sent status advance together in a transaction only after successful delivery. Failures remain queued with backoff and do not stop other recipients.
- Queued project messages are revalidated against current public snapshots and deadlines before delivery. Changed records are cancelled and rebuilt. A reminder is sent only two local calendar days before a verified upcoming hearing and expires after that delivery window.
- Withdrawn/closed cases and passed hearings are not presented as upcoming. Expired comment deadlines suppress submission invitations while retaining the official record. Residential names, exact addresses, images, and private document titles are withheld by the shared privacy policy.
- Correction notifications are restricted to `corrections@localagendawatch.com`, queued only after approval, and have their own unsubscribe-capable internal subscription. They identify the report as unverified.

## Verification

Run `npm test`, `npx tsc --noEmit`, targeted ESLint, and a production-mode build before deployment. Regression coverage includes previous-value diffs, canonical deduplication, subject counts, name scrubbing, timed deadlines, withdrawn cases, size splitting, test-recipient authorization, the cron approval gate, and a PGlite batch containing **251 watches for one recipient plus a second recipient**, including provider failure and successful retry without losing state.

The local review artifact at `output/email-preview/index.html` contains 36 screenshots, all nine HTML/text pairs, and offline `.eml` files addressed to `preview@example.invalid`. Browser checks cover 375 px overflow, action-button height, alt text, image loading, dark colors, and gallery controls. Actual Gmail, Outlook, and Apple Mail inbox rendering is not claimed without an approved test send; the offline `.eml` files support local client review without sending.
