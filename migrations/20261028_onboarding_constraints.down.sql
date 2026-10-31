-- Remove only this repair's named constraints; preserve data and earlier constraints.
BEGIN;
ALTER TABLE law_jurisdiction_snapshots DROP CONSTRAINT IF EXISTS law_onboarding_launch_status_v1;
ALTER TABLE law_jurisdiction_approvals DROP CONSTRAINT IF EXISTS law_onboarding_admin_user_v1;
ALTER TABLE law_jurisdiction_ai_budgets DROP CONSTRAINT IF EXISTS law_onboarding_spent_v1;
ALTER TABLE law_jurisdiction_ai_budgets DROP CONSTRAINT IF EXISTS law_onboarding_reserved_v1;
COMMIT;
