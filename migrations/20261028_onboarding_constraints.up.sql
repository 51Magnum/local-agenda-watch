-- Repair tables created by the former runtime initializer without CHECK constraints.
-- Run against the intended database using the migration owner, never a preview runtime.
BEGIN;
DO $migration$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='law_onboarding_launch_status_v1' AND conrelid='law_jurisdiction_snapshots'::regclass) THEN
  ALTER TABLE law_jurisdiction_snapshots ADD CONSTRAINT law_onboarding_launch_status_v1 CHECK (launch_status IN ('draft','qa','admin_only','public')) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='law_onboarding_admin_user_v1' AND conrelid='law_jurisdiction_approvals'::regclass) THEN
  ALTER TABLE law_jurisdiction_approvals ADD CONSTRAINT law_onboarding_admin_user_v1 CHECK (length(trim(admin_user)) > 0) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='law_onboarding_spent_v1' AND conrelid='law_jurisdiction_ai_budgets'::regclass) THEN
  ALTER TABLE law_jurisdiction_ai_budgets ADD CONSTRAINT law_onboarding_spent_v1 CHECK (spent >= 0) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='law_onboarding_reserved_v1' AND conrelid='law_jurisdiction_ai_budgets'::regclass) THEN
  ALTER TABLE law_jurisdiction_ai_budgets ADD CONSTRAINT law_onboarding_reserved_v1 CHECK (reserved >= 0) NOT VALID;
 END IF;
END
$migration$;
ALTER TABLE law_jurisdiction_snapshots VALIDATE CONSTRAINT law_onboarding_launch_status_v1;
ALTER TABLE law_jurisdiction_approvals VALIDATE CONSTRAINT law_onboarding_admin_user_v1;
ALTER TABLE law_jurisdiction_ai_budgets VALIDATE CONSTRAINT law_onboarding_spent_v1;
ALTER TABLE law_jurisdiction_ai_budgets VALIDATE CONSTRAINT law_onboarding_reserved_v1;
COMMIT;
