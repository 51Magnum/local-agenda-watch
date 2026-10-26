# Deployment from Git only

Vercel's GitHub integration builds pull-request previews and deploys `main` to production. Do not upload a local checkout or local build with the Vercel CLI, even for a preview. Do not promote an older CLI deployment. See AGENTS.md for the mandatory policy.

1. Commit and push a branch, then open a PR into `main`.
2. Wait for GitHub `verify` (tests and TypeScript) and Vercel's Git preview build to pass. Check the actual preview behavior before merging.
3. Merge the PR only with the owner's authorization. Let Vercel build production from the merged `main` commit.
4. Use the Vercel deployment API or dashboard to verify `source: git`, `gitSource.type: github`, and `gitSource.sha` equal GitHub's `main` commit SHA. Git metadata on a CLI upload is not proof of a Git-sourced build.
5. Check `/api/version` on the live site. Its public `commit` must equal the merged commit and its `provider` must be `github`. It exposes no credentials.
6. For source-data changes, dispatch the existing `Refresh case timelines` GitHub workflow with `force=true` after production is ready, then verify successful per-area source checks.

If the integration needs an explicit trigger, use Vercel's deployment API with an immutable GitHub `gitSource` reference. The request must not contain `files` or reference an existing local-upload deployment. Do not pass local files as a fallback.

Keep `ALERTS_DELIVERY_ENABLED`, `ALERTS_WAITLIST_CONFIRMATIONS_ENABLED`, and `ALERTS_ANNOUNCEMENTS_ENABLED` false until the owner separately approves enabling subscriber delivery. A deployment, PR merge, or test email is not approval to send to subscribers.
