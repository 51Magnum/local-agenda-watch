BEGIN;
DROP TABLE IF EXISTS law_jurisdiction_exception_decisions;
DROP TABLE IF EXISTS law_jurisdiction_exceptions;
DROP TABLE IF EXISTS law_jurisdiction_publications;
DELETE FROM law_schema_migrations WHERE id='20261031_self_check.up.sql';
COMMIT;
