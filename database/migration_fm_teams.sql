-- ============================================================================
-- VISION ENTREPRENEUR PLATFORM - MIGRATION: FM TEAMS
-- Adds: fm_teams, fm_team_members tables
-- For: Field Manager team management feature
-- ============================================================================

USE saviess_vep;  -- For local MySQL
-- USE test;       -- For TiDB Cloud

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 27. Table: fm_teams
-- Purpose: Named team groups created by a Field Manager to organize
--          their Field Officers into logical units
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fm_teams (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT DEFAULT NULL,
    manager_user_id INT UNSIGNED NOT NULL,
    status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fmteams_manager FOREIGN KEY (manager_user_id) 
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_team_name_manager (manager_user_id, name),
    INDEX idx_fmteams_manager (manager_user_id),
    INDEX idx_fmteams_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 28. Table: fm_team_members
-- Purpose: Junction table mapping Field Officers into teams.
--          An FO can belong to multiple teams if needed.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fm_team_members (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id INT UNSIGNED NOT NULL,
    fo_id INT UNSIGNED NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fmtm_team FOREIGN KEY (team_id) 
        REFERENCES fm_teams (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_fmtm_fo FOREIGN KEY (fo_id) 
        REFERENCES field_officers (id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_team_fo (team_id, fo_id),
    INDEX idx_fmtm_team (team_id),
    INDEX idx_fmtm_fo (fo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
