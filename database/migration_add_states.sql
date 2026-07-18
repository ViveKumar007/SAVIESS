-- ============================================================================
-- MIGRATION: Add States Table for Multi-State Support
-- Run this migration on existing databases to add state-level hierarchy
-- ============================================================================

USE saviess_vep;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. Create states master table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS states (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_state_name (name),
    INDEX idx_state_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Seed all 28 Indian States + 8 Union Territories
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO states (name, code) VALUES
    ('Andhra Pradesh', 'AP'),
    ('Arunachal Pradesh', 'AR'),
    ('Assam', 'AS'),
    ('Bihar', 'BR'),
    ('Chhattisgarh', 'CG'),
    ('Goa', 'GA'),
    ('Gujarat', 'GJ'),
    ('Haryana', 'HR'),
    ('Himachal Pradesh', 'HP'),
    ('Jharkhand', 'JH'),
    ('Karnataka', 'KA'),
    ('Kerala', 'KL'),
    ('Madhya Pradesh', 'MP'),
    ('Maharashtra', 'MH'),
    ('Manipur', 'MN'),
    ('Meghalaya', 'ML'),
    ('Mizoram', 'MZ'),
    ('Nagaland', 'NL'),
    ('Odisha', 'OD'),
    ('Punjab', 'PB'),
    ('Rajasthan', 'RJ'),
    ('Sikkim', 'SK'),
    ('Tamil Nadu', 'TN'),
    ('Telangana', 'TG'),
    ('Tripura', 'TR'),
    ('Uttar Pradesh', 'UP'),
    ('Uttarakhand', 'UK'),
    ('West Bengal', 'WB'),
    -- Union Territories
    ('Andaman and Nicobar Islands', 'AN'),
    ('Chandigarh', 'CH'),
    ('Dadra and Nagar Haveli and Daman and Diu', 'DD'),
    ('Delhi', 'DL'),
    ('Jammu and Kashmir', 'JK'),
    ('Ladakh', 'LA'),
    ('Lakshadweep', 'LD'),
    ('Puducherry', 'PY');

-- ----------------------------------------------------------------------------
-- 3. Add state_id column to districts table (link districts to states)
-- ----------------------------------------------------------------------------
ALTER TABLE districts
    ADD COLUMN state_id INT UNSIGNED NULL AFTER id;
ALTER TABLE districts
    ADD CONSTRAINT fk_districts_state_id FOREIGN KEY (state_id)
        REFERENCES states (id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Link existing Bihar districts to Bihar state
UPDATE districts d
    SET d.state_id = (SELECT id FROM states WHERE code = 'BR')
    WHERE d.state_id IS NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Migration complete. All 36 states/UTs seeded.
-- Existing Bihar districts linked to Bihar state record.
-- ============================================================================
