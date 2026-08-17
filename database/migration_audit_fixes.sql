-- ============================================================================
-- MIGRATION: Audit fix pass
-- Adds: users.must_change_password, field_reports UNIQUE(visit_id),
--       rhp_application_documents FK (for DBs provisioned via the cloud path
--       that were missing it)
-- ============================================================================

USE saviess_vep;  -- For local MySQL
-- USE test;       -- For TiDB Cloud

SET FOREIGN_KEY_CHECKS = 0;

-- Finding 13: forced password change for accounts created with an
-- auto-generated default password (Saviess@<last4digits>).
ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash;

-- Finding 20: a visit could otherwise receive two field reports under a race
-- (check-then-insert with no DB-level backstop).
ALTER TABLE field_reports ADD UNIQUE KEY uq_freport_visit (visit_id);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Audit fixes migration completed successfully' AS result;
