BEGIN;
CREATE TABLE IF NOT EXISTS law_jurisdiction_collection_progress(
 area_id text PRIMARY KEY,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 lease_token text,
 lease_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
