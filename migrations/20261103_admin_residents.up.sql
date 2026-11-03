ALTER TABLE law_resident_profiles ADD COLUMN IF NOT EXISTS resident_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS law_resident_profile_id ON law_resident_profiles(resident_id);
ALTER TABLE law_resident_profiles ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
-- Confirmation/import timestamps do not establish that someone signed in.
UPDATE law_resident_profiles p SET last_sign_in_at=s.last_sign_in
FROM (SELECT scope,email,max(created_at) AS last_sign_in FROM law_resident_sessions GROUP BY scope,email) s
WHERE p.scope=s.scope AND p.email=s.email AND p.last_sign_in_at IS NULL;
CREATE TABLE IF NOT EXISTS law_resident_plan_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope text NOT NULL,
 resident_id uuid REFERENCES law_resident_profiles(resident_id) ON DELETE SET NULL,
 actor text NOT NULL, action text NOT NULL CHECK(action='resident.plan.change'),
 old_plan text NOT NULL CHECK(old_plan IN ('free','paid')),
 new_plan text NOT NULL CHECK(new_plan IN ('free','paid') AND new_plan<>old_plan),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS law_resident_plan_changes_recent ON law_resident_plan_changes(scope,created_at DESC);
CREATE TABLE IF NOT EXISTS law_resident_plan_intents (
 token_hash text PRIMARY KEY,scope text NOT NULL,actor text NOT NULL,
 resident_id uuid NOT NULL REFERENCES law_resident_profiles(resident_id) ON DELETE CASCADE,
 old_plan text NOT NULL CHECK(old_plan IN ('free','paid')),
 new_plan text NOT NULL CHECK(new_plan IN ('free','paid') AND new_plan<>old_plan),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE INDEX IF NOT EXISTS law_resident_plan_intents_expiry ON law_resident_plan_intents(expires_at);
