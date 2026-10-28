-- Operational rollback: export QA/approval/spend history before dropping these tables.
DROP TABLE IF EXISTS law_jurisdiction_ai_calls;
DROP TABLE IF EXISTS law_jurisdiction_ai_budgets;
DROP TABLE IF EXISTS law_jurisdiction_approvals;
DROP TABLE IF EXISTS law_jurisdiction_qa;
DROP TABLE IF EXISTS law_jurisdiction_snapshots;
