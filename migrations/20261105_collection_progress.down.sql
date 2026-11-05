BEGIN;
DROP TABLE IF EXISTS law_jurisdiction_collection_progress;
DELETE FROM law_schema_migrations WHERE id='20261105_collection_progress.up.sql';
COMMIT;
