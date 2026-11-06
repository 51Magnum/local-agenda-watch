BEGIN;
DROP TABLE IF EXISTS law_jurisdiction_source_evidence;
DELETE FROM law_schema_migrations WHERE id='20261106_source_evidence.up.sql';
COMMIT;
