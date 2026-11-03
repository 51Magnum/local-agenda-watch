# Resident account administration

Open **Resident accounts and plans** from `/admin`. The page and all of its routes reuse the existing reviewer Basic authentication and `REVIEW_ADMIN_PASSWORD`; there is no new login, secret, service, or environment setting. Preview does not access account storage or allow plan changes.

Search accepts an exact email or literal partial email, case-insensitively, in a POST body. Results are capped at 50 and contain only email, plan, active/inactive pin counts, account creation date, and last sign-in. Email searches never enter URLs, and account links use opaque UUIDs. Details show pin labels, radii, active/inactive status and email consent, without coordinates or a location map. Dates use Mountain Time.

Select a plan and choose **Review plan change**, then explicitly confirm on the second screen. The server stores only a hash of the 10-minute, single-use confirmation token. Confirmation locks the account and refuses a stale plan. A normal profile update invokes the existing plan/pin triggers: Free keeps one active pin at 1 mile, retains extras inactive, and stops their alerts. Upgrading does not reactivate pins or restart email. No payment flow is added.

The profile update and the private `law_resident_plan_changes` audit insert share a transaction. Each entry records the opaque account ID, current reviewer identity (`admin` under the existing shared login), action, old/new plan and time. The audit table stores no email, name, IP, password, or pin location. Recent changes are visible only on the protected admin pages. Failures return generic messages and are not logged with personal data.

The normal `20261103_admin_residents.up.sql` migration runs automatically through the existing resident schema runner, once under its lock and checksum ledger. It adds account IDs, `last_sign_in_at`, audit records, and confirmation intents. Known last sign-ins are backfilled from existing session creation history; accounts without that evidence show **Not recorded**. Future successful magic-link consumption updates the timestamp; link requests and failed/reused links do not. Existing plans and pin rules are unchanged. The matching down migration removes these additions, including audit history; it does not revert plans or pin states.

All account pages and route responses are private, uncached, and excluded from indexing. They are not added to public navigation or the sitemap. No production migration, account lookup or plan change is run from the development shell.
