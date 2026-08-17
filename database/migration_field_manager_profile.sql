-- ============================================================================
-- MIGRATION: Field Manager Profile
-- Adds: field_managers
-- For: Admin Dashboard Field Manager overview — Employee ID, assigned region,
--      and an availability status (Active / On Leave / Inactive) that is
--      deliberately independent of users.is_active (account login access).
-- ============================================================================

USE saviess_vep;  -- For local MySQL
-- USE test;       -- For TiDB Cloud

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 36. Table: field_managers
-- Purpose: Profile data for users with role='field_manager', mirroring the
--          existing field_officers / rhps profile-table pattern.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_managers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    employee_code VARCHAR(20) NOT NULL UNIQUE,     -- e.g. FM-00001
    district_id INT UNSIGNED NOT NULL,
    block_id INT UNSIGNED NOT NULL,
    coverage_area TEXT DEFAULT NULL,
    availability_status ENUM('active', 'on_leave', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fm_profile_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_fm_profile_district FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_fm_profile_block FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_fm_profile_availability (availability_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Field Manager profile migration completed successfully' AS result;
