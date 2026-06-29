-- ============================================================================
-- VISION ENTREPRENEUR PLATFORM - DATABASE SCHEMA
-- Joint Initiative: Preheal, SAVIESS, and VisionSpring (Bihar, India)
-- Target Database: MySQL 8.0+
-- Design Version: 1.0.0
-- ============================================================================

-- Create local database if running locally (ignored on TiDB Cloud which uses 'test')
CREATE DATABASE IF NOT EXISTS saviess_vep CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database configured in your .env DB_NAME
-- For TiDB Cloud: DB_NAME=test  |  For local MySQL: DB_NAME=saviess_vep
-- Uncomment the appropriate line below:
USE saviess_vep;
-- USE test;

-- Disable foreign key checks temporarily to avoid dependency creation order issues
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. Table: districts
-- Purpose: Master table containing list of operational districts in Bihar
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS districts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_district_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Table: blocks
-- Purpose: Master table containing administrative blocks mapped to districts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    district_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_blocks_district_id FOREIGN KEY (district_id) 
        REFERENCES districts (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_district_block (district_id, name),
    INDEX idx_block_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Table: users
-- Purpose: Base user account model supporting JWT Auth and RBAC
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('super_admin', 'program_director', 'field_manager', 'field_officer', 'rhp') NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role),
    INDEX idx_user_status (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Table: rhp_applications
-- Purpose: Tracking system for Rural Health Provider (RHP) / Vision Entrepreneur applicants
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rhp_applications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender ENUM('male', 'female', 'other') NOT NULL,
    age INT UNSIGNED NOT NULL,
    phone VARCHAR(20) NOT NULL,
    district_id INT UNSIGNED NOT NULL,
    block_id INT UNSIGNED NOT NULL,
    village VARCHAR(150) NOT NULL,
    qualification VARCHAR(150) NOT NULL,
    experience TEXT DEFAULT NULL,
    status ENUM('applied', 'under_review', 'interviewed', 'training_scheduled', 'approved', 'rejected') NOT NULL DEFAULT 'applied',
    comments TEXT DEFAULT NULL,
    created_by_user_id INT UNSIGNED NULL,
    updated_by_user_id INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rhp_apps_district_id FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_rhp_apps_block_id FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_rhp_apps_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_rhp_apps_updater FOREIGN KEY (updated_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_rhp_app_status (status),
    INDEX idx_rhp_app_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Table: rhps
-- Purpose: Core details of Rural Health Providers (Vision Entrepreneurs) once onboarded
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rhps (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    application_id INT UNSIGNED DEFAULT NULL UNIQUE,
    center_name VARCHAR(150) NOT NULL,
    district_id INT UNSIGNED NOT NULL,
    block_id INT UNSIGNED NOT NULL,
    village VARCHAR(150) NOT NULL,
    status ENUM('active', 'suspended', 'inactive') NOT NULL DEFAULT 'active',
    toolkit_issued TINYINT(1) NOT NULL DEFAULT 0,
    total_patients_screened INT UNSIGNED NOT NULL DEFAULT 0,
    total_glasses_dispensed INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rhps_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_rhps_app_id FOREIGN KEY (application_id) REFERENCES rhp_applications (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_rhps_district_id FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_rhps_block_id FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_rhp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Table: field_officers
-- Purpose: Core details of Field Officers responsible for tracking and managing RHPs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_officers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    manager_id INT UNSIGNED NULL, -- References users.id (role program_director/field_manager)
    district_id INT UNSIGNED NOT NULL,
    block_id INT UNSIGNED NOT NULL,
    coverage_area TEXT DEFAULT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fos_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_fos_manager_id FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_fos_district_id FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_fos_block_id FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_fo_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Table: proof_uploads
-- Purpose: Centrally registers upload attachments linked to Cloudinary URLs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proof_uploads (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uploader_user_id INT UNSIGNED NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(150) NOT NULL UNIQUE, -- Cloudinary public ID for secure deletion
    file_size_bytes INT UNSIGNED NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    module_context ENUM('visit_proof', 'applicant_kyc', 'screening_proof', 'other') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_proofs_uploader FOREIGN KEY (uploader_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_proofs_context (module_context)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. Table: fo_visits
-- Purpose: Logging daily visits made by Field Officers to RHPs or centers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fo_visits (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fo_id INT UNSIGNED NOT NULL,
    target_rhp_id INT UNSIGNED NULL, -- Optional if visit is to an RHP
    visit_date DATE NOT NULL,
    purpose ENUM('routine', 'onboarding', 'training_audit', 'inventory_delivery', 'other') NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address_captured TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    status ENUM('planned', 'completed', 'cancelled') NOT NULL DEFAULT 'planned',
    check_in_time TIMESTAMP NULL DEFAULT NULL,
    check_out_time TIMESTAMP NULL DEFAULT NULL,
    proof_image_id INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_visits_fo_id FOREIGN KEY (fo_id) REFERENCES field_officers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_visits_rhp_id FOREIGN KEY (target_rhp_id) REFERENCES rhps (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_visits_proof_id FOREIGN KEY (proof_image_id) REFERENCES proof_uploads (id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_visit_fo_date (fo_id, visit_date),
    INDEX idx_visit_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. Table: fo_live_location
-- Purpose: Holds the most recent GPS location status of online Field Officers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fo_live_location (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fo_id INT UNSIGNED NOT NULL UNIQUE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2) DEFAULT NULL,
    battery_level TINYINT UNSIGNED DEFAULT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_live_loc_fo_id FOREIGN KEY (fo_id) REFERENCES field_officers (id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_live_loc_time (last_updated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. Table: fo_location_history
-- Purpose: Auditing breadcrumbs/history of FO movements for real-time tracking playback
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fo_location_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fo_id INT UNSIGNED NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2) DEFAULT NULL,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_loc_hist_fo_id FOREIGN KEY (fo_id) REFERENCES field_officers (id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_loc_hist_fo_time (fo_id, captured_at),
    INDEX idx_loc_hist_captured (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. Table: training_batches
-- Purpose: Cohorts organized by the program for RHP capacity building
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_batches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    trainer_name VARCHAR(150) NOT NULL,
    status ENUM('scheduled', 'ongoing', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_batch_dates (start_date, end_date),
    INDEX idx_batch_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. Table: training_attendance
-- Purpose: Log attendance registers per trainee per training date
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_attendance (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id INT UNSIGNED NOT NULL,
    trainee_user_id INT UNSIGNED NOT NULL, -- Links to users (typically roles = 'rhp' or applicants)
    date DATE NOT NULL,
    is_present TINYINT(1) NOT NULL DEFAULT 1,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_attend_batch_id FOREIGN KEY (batch_id) REFERENCES training_batches (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_attend_trainee FOREIGN KEY (trainee_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_batch_trainee_date (batch_id, trainee_user_id, date),
    INDEX idx_attend_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. Table: training_fees
-- Purpose: Capture course fees and financials related to RHP trainingbatches
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_fees (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    batch_id INT UNSIGNED NOT NULL,
    trainee_user_id INT UNSIGNED NOT NULL,
    amount_charged DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('pending', 'partial', 'paid', 'waived') NOT NULL DEFAULT 'pending',
    payment_mode ENUM('cash', 'upi', 'bank_transfer', 'other') NULL,
    transaction_reference VARCHAR(100) DEFAULT NULL,
    payment_date DATE DEFAULT NULL,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fees_batch_id FOREIGN KEY (batch_id) REFERENCES training_batches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_fees_trainee FOREIGN KEY (trainee_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_batch_trainee_fees (batch_id, trainee_user_id),
    INDEX idx_fee_status (payment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 14. Table: patients
-- Purpose: Patient registry capturing demographic and basic identifier details
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender ENUM('male', 'female', 'other') NOT NULL,
    age INT UNSIGNED NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    district_id INT UNSIGNED NOT NULL,
    block_id INT UNSIGNED NOT NULL,
    village VARCHAR(150) NOT NULL,
    created_by_rhp_id INT UNSIGNED NOT NULL, -- Links to rhps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_patients_district_id FOREIGN KEY (district_id) REFERENCES districts (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_patients_block_id FOREIGN KEY (block_id) REFERENCES blocks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_patients_rhp FOREIGN KEY (created_by_rhp_id) REFERENCES rhps (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_patient_name (last_name, first_name),
    INDEX idx_patient_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 15. Table: screenings
-- Purpose: Captures refraction screening details and visual acuity results
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS screenings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id INT UNSIGNED NOT NULL,
    screened_by_rhp_id INT UNSIGNED NOT NULL,
    screening_date DATE NOT NULL,
    
    -- Visual Acuity values (e.g. '6/6', '6/12', '6/60', 'PL', 'NPL')
    visual_acuity_left VARCHAR(15) NOT NULL,
    visual_acuity_right VARCHAR(15) NOT NULL,
    
    -- Refraction Parameters: Spherical (e.g. -2.25, +3.50)
    spherical_left DECIMAL(4, 2) DEFAULT NULL,
    spherical_right DECIMAL(4, 2) DEFAULT NULL,
    
    -- Refraction Parameters: Cylindrical (e.g. -0.50, +1.25)
    cylindrical_left DECIMAL(4, 2) DEFAULT NULL,
    cylindrical_right DECIMAL(4, 2) DEFAULT NULL,
    
    -- Refraction Parameters: Axis (0 to 180 degrees)
    axis_left SMALLINT UNSIGNED DEFAULT NULL,
    axis_right SMALLINT UNSIGNED DEFAULT NULL,
    
    screening_type ENUM('presbyopia', 'refractive_error', 'cataract_suspect', 'normal', 'other') NOT NULL,
    referral_recommended TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_screen_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_screen_rhp_id FOREIGN KEY (screened_by_rhp_id) REFERENCES rhps (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_screen_date (screening_date),
    INDEX idx_screen_type (screening_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 16. Table: glass_dispensing
-- Purpose: Records spectacles dispensed to patient, payment received and invoices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS glass_dispensing (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    screening_id INT UNSIGNED NOT NULL,
    patient_id INT UNSIGNED NOT NULL,
    dispensed_by_rhp_id INT UNSIGNED NOT NULL,
    dispensing_date DATE NOT NULL,
    
    -- Prescribed metrics as double check/history of dispensed glass
    left_power_sph DECIMAL(4, 2) DEFAULT NULL,
    right_power_sph DECIMAL(4, 2) DEFAULT NULL,
    left_power_cyl DECIMAL(4, 2) DEFAULT NULL,
    right_power_cyl DECIMAL(4, 2) DEFAULT NULL,
    
    frame_type VARCHAR(50) NOT NULL, -- e.g., Full Rim, Half Rim, Rimless
    frame_color VARCHAR(50) NOT NULL,
    glass_type ENUM('reading', 'bifocal', 'single_vision') NOT NULL,
    
    cost DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    subsidy_applied TINYINT(1) NOT NULL DEFAULT 0,
    subsidy_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_dispense_screen FOREIGN KEY (screening_id) REFERENCES screenings (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_dispense_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_dispense_rhp FOREIGN KEY (dispensed_by_rhp_id) REFERENCES rhps (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_disp_date (dispensing_date),
    INDEX idx_disp_invoice (invoice_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 17. Table: inventory_central
-- Purpose: Central warehouse inventory tracked by power combination SKU
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_central (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE, -- E.g. RD-SPH+1.50-CYL-0.00 (Reading, SPH +1.50, CYL 0)
    glass_type ENUM('reading', 'bifocal', 'single_vision', 'frame', 'other') NOT NULL,
    left_power_sph DECIMAL(4, 2) DEFAULT NULL,
    right_power_sph DECIMAL(4, 2) DEFAULT NULL,
    left_power_cyl DECIMAL(4, 2) DEFAULT NULL,
    right_power_cyl DECIMAL(4, 2) DEFAULT NULL,
    quantity INT NOT NULL DEFAULT 0,
    safety_stock_level INT NOT NULL DEFAULT 10,
    unit_price DECIMAL(10, 2) NOT NULL,
    supplier_info VARCHAR(255) DEFAULT NULL,
    last_restocked_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_inv_central_sku (sku),
    INDEX idx_inv_central_type (glass_type),
    INDEX idx_inv_central_powers (left_power_sph, right_power_sph)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 18. Table: inventory_rhp
-- Purpose: Per-RHP local inventory stock of glasses tracked by SKU and power
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_rhp (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rhp_id INT UNSIGNED NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    glass_type ENUM('reading', 'bifocal', 'single_vision', 'frame', 'other') NOT NULL,
    left_power_sph DECIMAL(4, 2) DEFAULT NULL,
    right_power_sph DECIMAL(4, 2) DEFAULT NULL,
    left_power_cyl DECIMAL(4, 2) DEFAULT NULL,
    right_power_cyl DECIMAL(4, 2) DEFAULT NULL,
    quantity INT NOT NULL DEFAULT 0,
    safety_stock_level INT NOT NULL DEFAULT 2,
    unit_price DECIMAL(10, 2) NOT NULL,
    last_restocked_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_rhp_rhp_id FOREIGN KEY (rhp_id) REFERENCES rhps (id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_rhp_sku (rhp_id, sku),
    INDEX idx_inv_rhp_sku (sku),
    INDEX idx_inv_rhp_powers (left_power_sph, right_power_sph)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 19. Table: toolkit_inventory
-- Purpose: Master catalog tracking reusable toolkits (trial lens, charts, case)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS toolkit_inventory (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL UNIQUE,
    sku VARCHAR(100) NOT NULL UNIQUE,
    total_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    available_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    unit_price DECIMAL(10, 2) NOT NULL,
    description TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 20. Table: toolkit_issuance_log
-- Purpose: Tracking logs of toolkits issued/returned/damaged/lost for RHPs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS toolkit_issuance_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rhp_id INT UNSIGNED NOT NULL,
    toolkit_item_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    issued_by_user_id INT UNSIGNED NOT NULL, -- Admin or manager who authorized
    issued_date DATE NOT NULL,
    status ENUM('issued', 'returned', 'damaged', 'lost') NOT NULL DEFAULT 'issued',
    condition_on_issue VARCHAR(255) NOT NULL DEFAULT 'Good',
    condition_on_return VARCHAR(255) DEFAULT NULL,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_issue_rhp FOREIGN KEY (rhp_id) REFERENCES rhps (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_issue_toolkit FOREIGN KEY (toolkit_item_id) REFERENCES toolkit_inventory (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_issue_issuer FOREIGN KEY (issued_by_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_issuance_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 21. Table: indents
-- Purpose: Central head-requisition/indent tracking submitted by RHPs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    requester_rhp_id INT UNSIGNED NOT NULL,
    field_officer_id INT UNSIGNED NULL, -- Compiled/verified by Field Officer
    status ENUM('draft', 'pending_approval', 'approved', 'dispatched', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending_approval',
    total_items INT UNSIGNED NOT NULL DEFAULT 0,
    request_date DATE NOT NULL,
    approval_date DATE DEFAULT NULL,
    dispatch_date DATE DEFAULT NULL,
    delivery_date DATE DEFAULT NULL,
    approved_by_user_id INT UNSIGNED NULL, -- Admin / program director
    comments TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_indents_rhp FOREIGN KEY (requester_rhp_id) REFERENCES rhps (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_indents_fo FOREIGN KEY (field_officer_id) REFERENCES field_officers (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_indents_approver FOREIGN KEY (approved_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_indent_status (status),
    INDEX idx_indent_req_date (request_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 22. Table: indent_items
-- Purpose: Line items requested under a specific central indent
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indent_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    indent_id INT UNSIGNED NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    glass_type ENUM('reading', 'bifocal', 'single_vision', 'frame', 'other') NOT NULL,
    left_power_sph DECIMAL(4, 2) DEFAULT NULL,
    right_power_sph DECIMAL(4, 2) DEFAULT NULL,
    left_power_cyl DECIMAL(4, 2) DEFAULT NULL,
    right_power_cyl DECIMAL(4, 2) DEFAULT NULL,
    quantity_requested INT UNSIGNED NOT NULL,
    quantity_approved INT UNSIGNED NOT NULL DEFAULT 0,
    quantity_dispatched INT UNSIGNED NOT NULL DEFAULT 0,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ind_items_indent FOREIGN KEY (indent_id) REFERENCES indents (id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_ind_items_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 23. Table: referrals
-- Purpose: Referral directory tracking cases recommended to base hospital (e.g. cataracts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    screening_id INT UNSIGNED NOT NULL,
    patient_id INT UNSIGNED NOT NULL,
    referred_by_rhp_id INT UNSIGNED NOT NULL,
    referred_to_facility VARCHAR(255) NOT NULL, -- E.g. Base Hospital name
    referral_reason ENUM('cataract', 'glaucoma', 'severe_refractive_error', 'diabetic_retinopathy', 'other') NOT NULL,
    status ENUM('pending', 'visited', 'treated', 'closed') NOT NULL DEFAULT 'pending',
    follow_up_date DATE DEFAULT NULL,
    outcome_notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ref_screening FOREIGN KEY (screening_id) REFERENCES screenings (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ref_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_ref_rhp FOREIGN KEY (referred_by_rhp_id) REFERENCES rhps (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_ref_status (status),
    INDEX idx_ref_followup (follow_up_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- Core Indexes & Trigger Optimization (Optional addition)
-- Add triggers to sync stats automatically: e.g., incrementing patient / glass counts
-- ----------------------------------------------------------------------------

DELIMITER $$

DROP TRIGGER IF EXISTS trg_after_screening_insert;
CREATE TRIGGER trg_after_screening_insert
AFTER INSERT ON screenings
FOR EACH ROW
BEGIN
    UPDATE rhps 
    SET total_patients_screened = total_patients_screened + 1 
    WHERE id = NEW.screened_by_rhp_id;
END$$

DROP TRIGGER IF EXISTS trg_after_dispense_insert;
CREATE TRIGGER trg_after_dispense_insert
AFTER INSERT ON glass_dispensing
FOR EACH ROW
BEGIN
    UPDATE rhps 
    SET total_glasses_dispensed = total_glasses_dispensed + 1 
    WHERE id = NEW.dispensed_by_rhp_id;
END$$

DELIMITER ;
