# Ada automatic onboarding verification


## Automatic gate

Every completed collection checks each record against its official source. Passing records are eligible; failures and uncertainty go to /admin/review. A new jurisdiction needs at least selfCheck.minPassRate (default 95%) and all coverage checks passing. The database records actor self-check, the source snapshot hash, QA, and approval. JSON publication fields do not authorize launch. There is no manual curl approval or config-promotion step.

Review decisions are tied to application and linked-source content hashes and reconsidered after source changes. Admin offers Approve as is, Apply fix, Hide, and jurisdiction Pause. Pause prevents public reads and survives a successful check. Unsafe source links or mismatched identities cannot be waived by generic approval.

## Verify before merge

- [ ] Run Node 24 checks: npm test, npx tsc --noEmit, npx eslint ., npm run build. Confirm the bundle scan passes.
- [ ] Run npm run law:jurisdiction -- check ada-county --dry-run --collect. Review redacted JSON/Markdown, particularly link failures, privacy uncertainty, exclusions and unmatched items.
- [ ] Verify the Git preview uses fresh checked records. An old staging count is not proof that this code ran.
- [ ] Review 1440x900 and 390x844 map/list, cases 202600273, 202502399, 202600864, 202600934, exception queue, and Boise's 404. Check six resident questions, source identity, Board vs P&Z, local dates, As of, AI labels where applicable, corrections link and disclaimer.
- [ ] Preserve the shared-hearing relationship without copying another project's case IDs. Organization subdivision 202600934 retains its development description.
- [ ] Confirm preview noindex, production email policy, and disabled preview subscriber delivery.
- [ ] Merge only when Shane is satisfied. Production must build the merged commit through Vercel's Git integration; compare its SHA with origin/main.


Preview onboarding uses committed, redacted snapshots. See [Adding a jurisdiction](ADDING_A_JURISDICTION.md); no separate infrastructure is required.
