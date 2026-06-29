-- ============================================================================
-- VISION ENTREPRENEUR PLATFORM - MIGRATION V2
-- Adds: partners, kpi_targets, field_reports tables
-- For: Program Director & Field Manager role-specific dashboards
-- ============================================================================

USE saviess_vep;  -- Uncomment for local MySQL
-- USE test;              -- TiDB Cloud database

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 24. Table: partners
-- Purpose: Track organizational partners (NGO, Govt, Corporate) managed by
--          Program Directors for state-level partnership oversight
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type ENUM('ngo', 'government', 'corporate', 'other') NOT NULL DEFAULT 'other',
    contact_person VARCHAR(150) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    email VARCHAR(150) DEFAULT NULL,
    district_id INT UNSIGNED NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    notes TEXT DEFAULT NULL,
    created_by_user_id INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_partners_district FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_partners_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_partner_type (type),
    INDEX idx_partner_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 25. Table: kpi_targets
-- Purpose: Monthly KPI targets set per district by Program Directors
--          to track program performance against goals
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kpi_targets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    district_id INT UNSIGNED NOT NULL,
    target_month DATE NOT NULL,                  -- First day of target month (e.g. 2026-06-01)
    screenings_target INT UNSIGNED NOT NULL DEFAULT 0,
    dispensings_target INT UNSIGNED NOT NULL DEFAULT 0,
    rhp_onboarding_target INT UNSIGNED NOT NULL DEFAULT 0,
    revenue_target DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_by_user_id INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_kpi_district FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_kpi_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    UNIQUE KEY uq_district_month (district_id, target_month),
    INDEX idx_kpi_month (target_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 26. Table: field_reports
-- Purpose: Field reports submitted by Field Officers after visits,
--          reviewed (approved/rejected) by Field Managers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    visit_id INT UNSIGNED NOT NULL,
    fo_id INT UNSIGNED NOT NULL,
    report_text TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    reviewed_by_user_id INT UNSIGNED NULL,
    review_comments TEXT DEFAULT NULL,
    reviewed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_freport_visit FOREIGN KEY (visit_id) REFERENCES fo_visits (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_freport_fo FOREIGN KEY (fo_id) REFERENCES field_officers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_freport_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_freport_status (status),
    INDEX idx_freport_fo (fo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
