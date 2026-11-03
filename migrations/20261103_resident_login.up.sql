CREATE TABLE IF NOT EXISTS law_resident_profiles (
 scope text NOT NULL, email text NOT NULL, display_name text NOT NULL DEFAULT '',
 email_verified_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(scope,email)
);
CREATE TABLE IF NOT EXISTS law_resident_login_links (
 token_hash text PRIMARY KEY, scope text NOT NULL, email text NOT NULL,
 expires_at timestamptz NOT NULL, return_to text NOT NULL
);
CREATE INDEX IF NOT EXISTS law_resident_link_expiry ON law_resident_login_links(expires_at);
CREATE TABLE IF NOT EXISTS law_resident_sessions (
 token_hash text PRIMARY KEY, scope text NOT NULL, email text NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(scope,email) REFERENCES law_resident_profiles(scope,email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS law_resident_session_expiry ON law_resident_sessions(expires_at);
CREATE TABLE IF NOT EXISTS law_resident_pins (
 id uuid PRIMARY KEY, scope text NOT NULL, email text NOT NULL,
 label text NOT NULL, longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 latitude double precision NOT NULL CHECK(latitude BETWEEN -85 AND 85),
 radius_miles double precision NOT NULL CHECK(radius_miles BETWEEN 0.25 AND 10),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(scope,email) REFERENCES law_resident_profiles(scope,email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS law_resident_pin_owner ON law_resident_pins(scope,email);
CREATE INDEX IF NOT EXISTS law_alert_email_owner ON law_alert_subscriptions(scope,lower(email));
