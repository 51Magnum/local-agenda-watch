BEGIN;
CREATE TABLE IF NOT EXISTS law_jurisdiction_source_evidence(
 area_id text NOT NULL,
 cycle_hash text NOT NULL,
 url text NOT NULL,
 url_hash text NOT NULL,
 data jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(area_id,cycle_hash,url_hash)
);
COMMIT;
