# Official upcoming-hearing meeting links

The shared `ProjectHearing` record has additive optional `meeting_url`, `agenda_url`, `packet_url`, `meeting_body`, `meeting_datetime`, `agenda_item_number`, `comment_deadline`, `comment_deadline_source_url`, `speak_signup_url`, and `last_checked_at` fields. Legacy camel-case fields still work. Pages, map panes, and email blocks use the same resolver and presentation helpers.

## Migration

`migrations/20261026_hearing_meetings.sql` creates the separate `law_hearing_meetings` table and its index without modifying existing project/feed rows. All meeting fields are nullable. ISO date/time strings remain text so a date-only source never becomes an invented midnight timestamp. The database rejects a deadline without a source URL. The store applies the idempotent migration on first use; it may also be applied by the usual PostgreSQL migration tooling. Vercel file tracing includes the SQL file. Regression tests apply it twice and verify existing rows survive.

## Sweep and provenance

The existing timeline sweep runs `refreshHearingMeetings` after source discovery. It polls PrimeGov once per run, groups joint case numbers, and matches the exact local hearing date and body. Published HTML meeting pages, compiled PDF agendas, and packets are checked before storage. The verified project hearing time is retained even when Council's general meeting starts earlier. Native PDF text is searched for exact case numbers and numbered agenda blocks; ambiguous matches leave the item number empty. HTML visible-item numbers are a fallback. Database IDs such as `AgendaItem_35512` are never displayed as agenda item numbers.

An unpublished agenda is a successful check, not an error. Nampa falls back to its official portal and an estimated preceding-Thursday publication date. Network/verification failures back off and stop at three attempts per case/hearing. The next admin retry resets that cap. Unattempted/older targets run first so a bounded sweep resumes deferred work. Successful checks record `last_checked_at`; failed attempts retain the previous successful time and an admin diagnostic. Automatic updates never replace `manual_override`.

The adapter registry contains explicit TODOs for Meridian, Canyon County, Kuna, Eagle, Star, and Middleton. Their existing official feed links and registered portals remain available; new meeting URLs are not guessed.

## Participation rules

- [Nampa hearing basics](https://www.cityofnampa.us/1722/Public-Hearings---the-Basics): written comments to PZall@cityofnampa.us by noon on the preceding Wednesday are included in the staff report. Later comments are handled separately. Agendas/packets normally post by the end of the preceding Thursday; the date is an estimate, not a publication guarantee.
- [Nampa public comment guidance](https://www.cityofnampa.us/1616/Public-Comment): regular-meeting portal comments are accepted until noon on hearing day. The city also permits speaker sign-up at the meeting, so LAW does not invent a noon speaker-sign-up cut-off. Special meetings do not inherit the regular portal deadline.
- [Nampa code 10-2-8.C](https://www.cityofnampa.us/DocumentCenter/View/13710/Chapter-2-Enforcement-and-Administration---Updated-04-01-2024?bidId=#page=18): standard public testimony is three minutes, applicant presentation seven, rebuttal five; the chair may announce different limits.

For Braeburn's November 2, 2026 hearing, the staff-report deadline is October 28 at noon MDT and the portal-comment deadline is November 2 at noon MST. Calculations use the local calendar through the daylight-saving transition. A sourced case-specific deadline takes precedence over general policy. Dates without a public source are hidden.

## Review and email

`/admin/review` lists matched meetings, links, timestamps and failure counts. Load an area/case to review an upcoming hearing before its first sweep. The manual form validates official HTTPS hosts, checks links, requires deadline provenance, and saves an override for that exact hearing. Empty manual fields remove a link; using automatic matching clears the override and resets retries.

Digests and project-follow blocks include the same navigation and sourced deadlines when a hearing is within fourteen local calendar days. Agenda/packet/item changes generate explicit diff lines. Routine link-check timestamps do not change subscriber snapshot fingerprints. Email delivery remains paused; previews and tests do not send to subscribers.
