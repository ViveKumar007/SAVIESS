-- ============================================================================
-- VISION ENTREPRENEUR PLATFORM - MIGRATION: PD MODULE
-- Adds: pd_field_visits, pd_eyeglass_colors, pd_eyeglass_stock,
--        pd_eyeglass_stock_log, pd_fo_allocation, pd_fo_allocation_log,
--        pd_fo_distribution
-- For: Program Director — Visits, Eyeglass Inventory & Distribution tracking
-- ============================================================================

USE saviess_vep;  -- For local MySQL
-- USE test;       -- For TiDB Cloud

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 29. Table: pd_field_visits
-- Purpose: Program Director field visit log with observations and remarks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pd_field_visits (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,           -- The PD who recorded the visit
    visit_date DATE NOT NULL,
    place VARCHAR(255) NOT NULL,
    key_observations TEXT DEFAULT NULL,
    areas_for_improvement TEXT DEFAULT NULL,
    remarks TEXT DEFAULT NULL,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0, -- Soft delete flag
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pd_visits_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_pd_visits_user (user_id),
    INDEX idx_pd_visits_date (visit_date),
    INDEX idx_pd_visits_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 30. Table: pd_eyeglass_colors
-- Purpose: Extensible master list of eyeglass frame colors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pd_eyeglass_colors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,         -- e.g. 'Red', 'Brown', 'Blue'
    hex_code VARCHAR(7) DEFAULT NULL,         -- e.g. '#EF4444' for UI display
    emoji VARCHAR(10) DEFAULT NULL,           -- e.g. '🔴'
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pd_colors_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the 3 default colors
INSERT IGNORE INTO pd_eyeglass_colors (name, hex_code, emoji) VALUES
    ('Red',   '#EF4444', '🔴'),
    ('Brown', '#92400E', '🟤'),
    ('Blue',  '#3B82F6', '🔵');

-- ----------------------------------------------------------------------------
-- 31. Table: pd_eyeglass_stock
-- Purpose: Central eyeglass inventory tracked by color
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pd_eyeglass_stock (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    color_id INT UNSIGNED NOT NULL UNIQUE,    -- One row per color
    quantity INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pd_stock_color FOREIGN KEY (color_id)
        REFERENCES pd_eyeglass_colors (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize stock rows for the 3 default colors (0 stock)
INSERT IGNORE INTO pd_eyeglass_stock (color_id, quantity)
    SELECT id, 0 FROM pd_eyeglass_colors;

-- ----------------------------------------------------------------------------
-- 32. Table: pd_eyeglass_stock_log
-- Purpose: Immutable audit log for every stock addition
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pd_eyeglass_stock_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    color_id INT UNSIGNED NOT NULL,
    quantity_added INT NOT NULL,
    performed_by INT UNSIGNED NOT NULL,       -- users.id
    notes VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pd_stocklog_color FOREIGN KEY (color_id)
        REFERENCES pd_eyeglass_colors (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pd_stocklog_user FOREIGN KEY (performed_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_pd_stocklog_color (color_id),
    INDEX idx_pd_stocklog_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 33. Table: pd_fo_allocation
-- Purpose: Eyeglasses allocated to a Field Officer, tracked per color
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pd_fo_allocation (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fo_id INT UNSIGNED NOT NULL,
    color_id INT UNSIGNED NOT NULL,
    quantity INT NOT NULL DEFAULT 0,          -- Current balance
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pd_alloc_fo FOREIGN KEY (fo_id)
        REFERENCES field_officers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pd_alloc_color FOREIGN KEY (color_id)
        REFERENCES pd_eyeglass_colors (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_fo_color (fo_id, color_id),
    INDEX idx_pd_alloc_fo (fo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 34. Table: pd_fo_allocation_log
-- Purpose: Immutable audit log for every allocation event
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pd_fo_allocation_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fo_id INT UNSIGNED NOT NULL,
    color_id INT UNSIGNED NOT NULL,
    quantity_allocated INT NOT NULL,
    performed_by INT UNSIGNED NOT NULL,       -- users.id
    notes VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pd_alloclog_fo FOREIGN KEY (fo_id)
        REFERENCES field_officers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pd_alloclog_color FOREIGN KEY (color_id)
        REFERENCES pd_eyeglass_colors (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pd_alloclog_user FOREIGN KEY (performed_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_pd_alloclog_fo (fo_id),
    INDEX idx_pd_alloclog_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 35. Table: pd_fo_distribution
-- Purpose: Records eyeglasses distributed to patients by Field Officers.
--          Mandatory proof upload (image/PDF URL).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pd_fo_distribution (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fo_id INT UNSIGNED NOT NULL,
    color_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    patient_name VARCHAR(200) DEFAULT NULL,
    patient_phone VARCHAR(20) DEFAULT NULL,
    patient_details TEXT DEFAULT NULL,
    proof_url VARCHAR(500) NOT NULL,          -- Cloudinary URL — mandatory
    proof_public_id VARCHAR(150) DEFAULT NULL, -- Cloudinary public_id for management
    distributed_by INT UNSIGNED NOT NULL,      -- users.id who recorded this
    distribution_date DATE NOT NULL,
    notes VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pd_dist_fo FOREIGN KEY (fo_id)
        REFERENCES field_officers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pd_dist_color FOREIGN KEY (color_id)
        REFERENCES pd_eyeglass_colors (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pd_dist_user FOREIGN KEY (distributed_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_pd_dist_fo (fo_id),
    INDEX idx_pd_dist_color (color_id),
    INDEX idx_pd_dist_date (distribution_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
