ALTER TABLE law_resident_profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free' CHECK(plan IN ('free','paid'));
CREATE TABLE IF NOT EXISTS law_resident_plan_policy (id boolean PRIMARY KEY DEFAULT true CHECK(id), paid_pin_limit integer NOT NULL CHECK(paid_pin_limit > 0));
ALTER TABLE law_resident_pins ADD COLUMN IF NOT EXISTS subscription_id uuid UNIQUE REFERENCES law_alert_subscriptions(id) ON DELETE SET NULL;
ALTER TABLE law_resident_pins ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Link already-confirmed email identities without confirming pending watches.
INSERT INTO law_resident_profiles(scope,email,email_verified_at)
SELECT scope,lower(email),min(confirmed_at) FROM law_alert_subscriptions
WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL AND target->>'kind'='place'
GROUP BY scope,lower(email) ON CONFLICT(scope,email) DO NOTHING;
INSERT INTO law_resident_pins(id,scope,email,label,longitude,latitude,radius_miles,created_at,subscription_id)
SELECT s.id,s.scope,lower(s.email),s.target->>'label',(s.target->'coordinates'->>0)::float8,
 (s.target->'coordinates'->>1)::float8,1,s.created_at,s.id
FROM law_alert_subscriptions s WHERE s.confirmed_at IS NOT NULL AND s.unsubscribed_at IS NULL AND s.target->>'kind'='place'
ON CONFLICT DO NOTHING;
-- Keep the oldest confirmed alert pin first; retain excess locations privately, inactive.
WITH ranked AS (SELECT id,row_number() OVER(PARTITION BY scope,email ORDER BY (subscription_id IS NOT NULL) DESC,created_at,id) AS n FROM law_resident_pins)
UPDATE law_resident_pins p SET archived=r.n>1,radius_miles=1 FROM ranked r WHERE p.id=r.id;
UPDATE law_alert_subscriptions s SET target=(CASE WHEN p.archived THEN s.target ELSE jsonb_set(s.target,'{radiusMiles}','1'::jsonb) END)||jsonb_build_object('pinId',p.id::text),
 unsubscribed_at=CASE WHEN p.archived THEN coalesce(s.unsubscribed_at,now()) ELSE s.unsubscribed_at END,state=NULL
FROM law_resident_pins p WHERE p.subscription_id=s.id;
-- Cancel pre-policy payloads rather than send an obsolete radius or inactive pin.
UPDATE law_alert_deliveries SET status='cancelled',last_error='Pin policy changed; rebuild from current preferences'
WHERE status='pending' AND kind IN ('digest','reminder');

CREATE OR REPLACE FUNCTION law_enforce_resident_pin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tier text; allowance integer;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.scope,NEW.email) IS DISTINCT FROM (OLD.scope,OLD.email) THEN
  RAISE EXCEPTION 'Pin ownership cannot change' USING ERRCODE='23514';
 END IF;
 -- All writers serialize on the owner row: concurrent inserts cannot exceed the limit.
 SELECT plan INTO tier FROM law_resident_profiles WHERE scope=NEW.scope AND email=NEW.email FOR UPDATE;
 IF tier IS NULL THEN RAISE EXCEPTION 'Pin owner required' USING ERRCODE='23514'; END IF;
 IF NEW.subscription_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM law_alert_subscriptions WHERE id=NEW.subscription_id AND scope=NEW.scope AND lower(email)=NEW.email AND target->>'kind'='place') THEN
  RAISE EXCEPTION 'Pin owner mismatch' USING ERRCODE='23514';
 END IF;
 IF NOT NEW.archived THEN
  allowance=CASE WHEN tier='paid' THEN coalesce((SELECT paid_pin_limit FROM law_resident_plan_policy WHERE id),1) ELSE 1 END;
  IF tier='free' AND NEW.radius_miles<>1 THEN RAISE EXCEPTION 'Free pins use a 1 mile radius' USING ERRCODE='23514'; END IF;
  IF (SELECT count(*) FROM law_resident_pins WHERE scope=NEW.scope AND email=NEW.email AND NOT archived AND id<>NEW.id)>=allowance THEN
   RAISE EXCEPTION 'Plan pin limit reached' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER law_resident_pin_policy BEFORE INSERT OR UPDATE ON law_resident_pins FOR EACH ROW EXECUTE FUNCTION law_enforce_resident_pin();

-- The old public confirmation/manage endpoints also pass through this policy.
CREATE OR REPLACE FUNCTION law_sync_alert_pin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pin_id uuid;
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (NEW.scope,lower(NEW.email)) IS DISTINCT FROM (OLD.scope,lower(OLD.email)) THEN
  RAISE EXCEPTION 'Watch ownership cannot change' USING ERRCODE='23514';
 END IF;
 IF NEW.target->>'kind'<>'place' THEN RETURN NEW; END IF;
 IF NEW.confirmed_at IS NULL OR NEW.unsubscribed_at IS NOT NULL THEN RETURN NEW; END IF;
 INSERT INTO law_resident_profiles(scope,email,email_verified_at) VALUES(NEW.scope,lower(NEW.email),NEW.confirmed_at) ON CONFLICT DO NOTHING;
 SELECT id INTO pin_id FROM law_resident_pins WHERE subscription_id=NEW.id;
 IF pin_id IS NULL THEN
  INSERT INTO law_resident_pins(id,scope,email,label,longitude,latitude,radius_miles,subscription_id)
  VALUES(NEW.id,NEW.scope,lower(NEW.email),NEW.target->>'label',(NEW.target->'coordinates'->>0)::float8,(NEW.target->'coordinates'->>1)::float8,(NEW.target->>'radiusMiles')::float8,NEW.id);
 ELSE
  UPDATE law_resident_pins SET label=NEW.target->>'label',longitude=(NEW.target->'coordinates'->>0)::float8,
   latitude=(NEW.target->'coordinates'->>1)::float8,radius_miles=(NEW.target->>'radiusMiles')::float8,archived=false WHERE id=pin_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER law_alert_pin_policy AFTER INSERT OR UPDATE OF target,confirmed_at,unsubscribed_at ON law_alert_subscriptions FOR EACH ROW EXECUTE FUNCTION law_sync_alert_pin();

CREATE OR REPLACE FUNCTION law_sync_resident_pin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NULL; END IF;
 IF TG_OP='DELETE' THEN
  UPDATE law_alert_subscriptions SET unsubscribed_at=coalesce(unsubscribed_at,now()) WHERE id=OLD.subscription_id;
 ELSE
  UPDATE law_alert_subscriptions SET target=jsonb_build_object('kind','place','label',NEW.label,'coordinates',jsonb_build_array(NEW.longitude,NEW.latitude),'radiusMiles',NEW.radius_miles,'pinId',NEW.id::text),
   unsubscribed_at=CASE WHEN NEW.archived THEN coalesce(unsubscribed_at,now()) ELSE unsubscribed_at END,state=NULL WHERE id=NEW.subscription_id;
 END IF;
 UPDATE law_alert_deliveries SET status='cancelled',last_error='Pin preferences changed; rebuild from current preferences'
 WHERE scope=OLD.scope AND email=OLD.email AND status='pending' AND kind IN ('digest','reminder');
 RETURN NULL;
END $$;
CREATE TRIGGER law_resident_pin_sync AFTER UPDATE OR DELETE ON law_resident_pins FOR EACH ROW EXECUTE FUNCTION law_sync_resident_pin();

CREATE OR REPLACE FUNCTION law_downgrade_resident_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.plan='free' AND OLD.plan<>'free' THEN
  WITH ranked AS (SELECT id,row_number() OVER(ORDER BY created_at,id) AS n FROM law_resident_pins WHERE scope=NEW.scope AND email=NEW.email AND NOT archived)
  UPDATE law_resident_pins p SET archived=true FROM ranked r WHERE p.id=r.id AND r.n>1;
  UPDATE law_alert_subscriptions s SET unsubscribed_at=coalesce(s.unsubscribed_at,now()) FROM law_resident_pins p WHERE p.scope=NEW.scope AND p.email=NEW.email AND p.archived AND p.subscription_id=s.id;
  UPDATE law_resident_pins SET radius_miles=1 WHERE scope=NEW.scope AND email=NEW.email;
  UPDATE law_alert_subscriptions s SET target=jsonb_set(s.target,'{radiusMiles}','1'::jsonb)||jsonb_build_object('pinId',p.id::text),state=NULL FROM law_resident_pins p WHERE p.scope=NEW.scope AND p.email=NEW.email AND NOT p.archived AND p.subscription_id=s.id;
  UPDATE law_alert_deliveries SET status='cancelled',last_error='Pin policy changed; rebuild from current preferences' WHERE scope=NEW.scope AND email=NEW.email AND status='pending' AND kind IN ('digest','reminder');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER law_resident_plan_downgrade AFTER UPDATE OF plan ON law_resident_profiles FOR EACH ROW EXECUTE FUNCTION law_downgrade_resident_plan();
