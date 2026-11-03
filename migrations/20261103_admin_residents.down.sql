DROP TABLE IF EXISTS law_resident_plan_intents;
DROP TABLE IF EXISTS law_resident_plan_changes;
ALTER TABLE law_resident_profiles DROP COLUMN IF EXISTS last_sign_in_at;
DROP INDEX IF EXISTS law_resident_profile_id;
ALTER TABLE law_resident_profiles DROP COLUMN IF EXISTS resident_id;
