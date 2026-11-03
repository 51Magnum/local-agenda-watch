DROP TRIGGER IF EXISTS law_resident_plan_downgrade ON law_resident_profiles;
DROP TRIGGER IF EXISTS law_alert_pin_policy ON law_alert_subscriptions;
DROP TRIGGER IF EXISTS law_resident_pin_policy ON law_resident_pins;
DROP TRIGGER IF EXISTS law_resident_pin_sync ON law_resident_pins;
DROP FUNCTION IF EXISTS law_sync_resident_pin();
DROP FUNCTION IF EXISTS law_downgrade_resident_plan();
DROP FUNCTION IF EXISTS law_sync_alert_pin();
DROP FUNCTION IF EXISTS law_enforce_resident_pin();
ALTER TABLE law_resident_pins DROP COLUMN IF EXISTS subscription_id, DROP COLUMN IF EXISTS archived;
ALTER TABLE law_resident_profiles DROP COLUMN IF EXISTS plan;
DROP TABLE IF EXISTS law_resident_plan_policy;
-- Previously stopped email subscriptions remain stopped; rollback never renews consent.
