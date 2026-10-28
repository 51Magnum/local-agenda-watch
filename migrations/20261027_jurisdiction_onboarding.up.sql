CREATE TABLE IF NOT EXISTS law_jurisdiction_snapshots (
 area_id text PRIMARY KEY, launch_status text NOT NULL DEFAULT 'admin_only' CHECK (launch_status IN ('draft','qa','admin_only','public')),
 data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS law_jurisdiction_qa (
 id text PRIMARY KEY, area_id text NOT NULL, data jsonb NOT NULL, passed boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS law_jurisdiction_approvals (
 id uuid PRIMARY KEY, area_id text NOT NULL, qa_id text NOT NULL REFERENCES law_jurisdiction_qa(id), admin_user text NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now(), CHECK (length(trim(admin_user)) > 0)
);
CREATE TABLE IF NOT EXISTS law_jurisdiction_ai_budgets (
 area_id text NOT NULL, bucket text NOT NULL, spent numeric NOT NULL DEFAULT 0 CHECK (spent >= 0),
 reserved numeric NOT NULL DEFAULT 0 CHECK (reserved >= 0), PRIMARY KEY (area_id,bucket)
);
CREATE TABLE IF NOT EXISTS law_jurisdiction_ai_calls (
 id uuid PRIMARY KEY, area_id text NOT NULL, buckets text[] NOT NULL, reservation numeric NOT NULL,
 cost numeric, input_tokens bigint, output_tokens bigint, created_at timestamptz NOT NULL DEFAULT now()
);
