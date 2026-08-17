-- ============================================================================
-- MIGRATION: RHP Registration Extended Fields + Application Documents
-- For local MySQL (database: saviess_vep) and TiDB Cloud
-- ============================================================================

USE saviess_vep;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. Extend rhp_applications with all new registration fields
-- ----------------------------------------------------------------------------

-- Auto-generated application code (RHP-YYYYMM-XXXXX)
ALTER TABLE rhp_applications ADD COLUMN application_code VARCHAR(20) DEFAULT NULL AFTER id;

-- Full name (public form uses single field)
ALTER TABLE rhp_applications ADD COLUMN full_name VARCHAR(200) DEFAULT NULL AFTER application_code;

-- Contact & Identity
ALTER TABLE rhp_applications ADD COLUMN date_of_birth DATE DEFAULT NULL AFTER age;
ALTER TABLE rhp_applications ADD COLUMN email VARCHAR(150) DEFAULT NULL AFTER phone;
ALTER TABLE rhp_applications ADD COLUMN aadhaar_number VARCHAR(12) DEFAULT NULL AFTER email;
ALTER TABLE rhp_applications ADD COLUMN pan_number VARCHAR(10) DEFAULT NULL AFTER aadhaar_number;

-- Professional Details
ALTER TABLE rhp_applications ADD COLUMN registration_number VARCHAR(100) DEFAULT NULL AFTER qualification;
ALTER TABLE rhp_applications ADD COLUMN registration_authority VARCHAR(150) DEFAULT NULL AFTER registration_number;
ALTER TABLE rhp_applications ADD COLUMN years_of_experience INT UNSIGNED DEFAULT 0 AFTER registration_authority;

-- Practice Location
ALTER TABLE rhp_applications ADD COLUMN clinic_name VARCHAR(200) DEFAULT NULL AFTER village;
ALTER TABLE rhp_applications ADD COLUMN address TEXT DEFAULT NULL AFTER clinic_name;
ALTER TABLE rhp_applications ADD COLUMN state VARCHAR(100) DEFAULT 'Bihar' AFTER address;
ALTER TABLE rhp_applications ADD COLUMN pin_code VARCHAR(6) DEFAULT NULL AFTER state;

-- Infrastructure Availability (booleans)
ALTER TABLE rhp_applications ADD COLUMN has_consultation_space TINYINT(1) DEFAULT 0 AFTER pin_code;
ALTER TABLE rhp_applications ADD COLUMN has_screening_space TINYINT(1) DEFAULT 0 AFTER has_consultation_space;
ALTER TABLE rhp_applications ADD COLUMN has_electricity TINYINT(1) DEFAULT 0 AFTER has_screening_space;
ALTER TABLE rhp_applications ADD COLUMN has_smartphone TINYINT(1) DEFAULT 0 AFTER has_electricity;
ALTER TABLE rhp_applications ADD COLUMN has_internet TINYINT(1) DEFAULT 0 AFTER has_smartphone;

-- Infrastructure (text)
ALTER TABLE rhp_applications ADD COLUMN storage_space VARCHAR(255) DEFAULT NULL AFTER has_internet;
ALTER TABLE rhp_applications ADD COLUMN medicine_shop VARCHAR(255) DEFAULT NULL AFTER storage_space;

-- Experience
ALTER TABLE rhp_applications ADD COLUMN health_camp_experience TEXT DEFAULT NULL AFTER medicine_shop;
ALTER TABLE rhp_applications ADD COLUMN eye_care_experience TEXT DEFAULT NULL AFTER health_camp_experience;

-- Interest in Program
ALTER TABLE rhp_applications ADD COLUMN why_join_reason TEXT DEFAULT NULL AFTER eye_care_experience;
ALTER TABLE rhp_applications ADD COLUMN patients_per_day INT UNSIGNED DEFAULT 0 AFTER why_join_reason;

-- Financial Commitment
ALTER TABLE rhp_applications ADD COLUMN willing_to_invest TINYINT(1) DEFAULT 0 AFTER patients_per_day;

-- Bank Details
ALTER TABLE rhp_applications ADD COLUMN bank_account_holder VARCHAR(200) DEFAULT NULL AFTER willing_to_invest;
ALTER TABLE rhp_applications ADD COLUMN bank_name VARCHAR(200) DEFAULT NULL AFTER bank_account_holder;
ALTER TABLE rhp_applications ADD COLUMN bank_account_number VARCHAR(30) DEFAULT NULL AFTER bank_name;
ALTER TABLE rhp_applications ADD COLUMN bank_ifsc VARCHAR(11) DEFAULT NULL AFTER bank_account_number;

-- Declaration & Draft
ALTER TABLE rhp_applications ADD COLUMN declaration_agreed TINYINT(1) DEFAULT 0 AFTER bank_ifsc;
ALTER TABLE rhp_applications ADD COLUMN is_draft TINYINT(1) DEFAULT 0 AFTER declaration_agreed;

-- Add unique index on application_code
ALTER TABLE rhp_applications ADD UNIQUE INDEX idx_app_code (application_code);

-- ----------------------------------------------------------------------------
-- 2. Relax NOT NULL constraints so optional fields can be left empty
-- ----------------------------------------------------------------------------
ALTER TABLE rhp_applications MODIFY COLUMN age INT UNSIGNED DEFAULT 0;
ALTER TABLE rhp_applications MODIFY COLUMN village VARCHAR(150) DEFAULT NULL;
ALTER TABLE rhp_applications MODIFY COLUMN qualification VARCHAR(150) DEFAULT NULL;
ALTER TABLE rhp_applications MODIFY COLUMN district_id INT UNSIGNED DEFAULT NULL;
ALTER TABLE rhp_applications MODIFY COLUMN block_id INT UNSIGNED DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- 3. Create rhp_application_documents table for file uploads
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rhp_application_documents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id INT UNSIGNED NOT NULL,
    document_type ENUM('photograph', 'aadhaar', 'pan', 'registration_certificate', 'supporting') NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) DEFAULT NULL,
    file_size_bytes INT UNSIGNED DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_docs_application FOREIGN KEY (application_id) REFERENCES rhp_applications (id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_app_docs_app_id (application_id),
    INDEX idx_app_docs_type (document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Cloud migration completed successfully' AS result;
