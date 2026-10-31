CREATE TABLE IF NOT EXISTS law_jurisdiction_publications (
 area_id text PRIMARY KEY, status text NOT NULL CHECK(status IN ('review','public','paused')),
 approval_id uuid REFERENCES law_jurisdiction_approvals(id), snapshot_hash text NOT NULL,
 actor text NOT NULL, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS law_jurisdiction_exceptions (
 area_id text NOT NULL, record_id text NOT NULL, source_hash text NOT NULL,
 data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(area_id,record_id,source_hash)
);
CREATE TABLE IF NOT EXISTS law_jurisdiction_exception_decisions (
 area_id text NOT NULL, record_id text NOT NULL, source_hash text NOT NULL,
 action text NOT NULL CHECK(action IN ('approve','fix','hide')), reviewer text NOT NULL CHECK(length(trim(reviewer))>0),
 proposal jsonb, decided_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(area_id,record_id,source_hash)
);
