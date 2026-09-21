-- ============================================================
-- CivicConnect - Migration Script (MySQL 5.7 Compatible)
-- ============================================================

USE civic_complaints_db;

-- ============================================================
-- STEP 1: ADD COLUMNS TO users TABLE (using stored procedure
--         to safely skip if column already exists)
-- ============================================================

DROP PROCEDURE IF EXISTS add_column_if_not_exists;

DELIMITER $$
CREATE PROCEDURE add_column_if_not_exists(
    IN p_table VARCHAR(100),
    IN p_column VARCHAR(100),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = p_table
          AND COLUMN_NAME  = p_column
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- Add phone
CALL add_column_if_not_exists('users', 'phone', 'VARCHAR(20) DEFAULT NULL');

-- Add address
CALL add_column_if_not_exists('users', 'address', 'TEXT DEFAULT NULL');

-- Add is_active
CALL add_column_if_not_exists('users', 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE');

-- Add department_id
CALL add_column_if_not_exists('users', 'department_id', 'INT DEFAULT NULL');

-- Add updated_at
CALL add_column_if_not_exists('users', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

-- ============================================================
-- STEP 2: ADD role COLUMN (ENUM - handle separately)
-- ============================================================

DROP PROCEDURE IF EXISTS add_role_column;

DELIMITER $$
CREATE PROCEDURE add_role_column()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'users'
          AND COLUMN_NAME  = 'role'
    ) THEN
        ALTER TABLE users
            ADD COLUMN role ENUM('citizen','admin','department_officer') NOT NULL DEFAULT 'citizen';
    END IF;
END$$
DELIMITER ;

CALL add_role_column();

-- ============================================================
-- STEP 3: FIX EXISTING ROWS
-- ============================================================

-- All existing users get citizen role
UPDATE users SET role = 'citizen' WHERE role IS NULL OR role = '';

-- Set admin role for admin email
UPDATE users SET role = 'admin', is_active = TRUE
WHERE email = 'admin@civicconnect.com';

-- ============================================================
-- STEP 4: complaints TABLE - add missing columns
-- ============================================================

CALL add_column_if_not_exists('complaints', 'latitude',      'DECIMAL(10,8) DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'longitude',     'DECIMAL(11,8) DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'department_id', 'INT DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'assigned_to',   'INT DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'ai_category',   'VARCHAR(100) DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'ai_priority',   'VARCHAR(50) DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'ai_summary',    'TEXT DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'ai_suggestion', 'TEXT DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'is_duplicate',  'BOOLEAN NOT NULL DEFAULT FALSE');
CALL add_column_if_not_exists('complaints', 'duplicate_of',  'INT DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'resolved_at',   'DATETIME DEFAULT NULL');
CALL add_column_if_not_exists('complaints', 'updated_at',    'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

-- Add priority column (ENUM)
DROP PROCEDURE IF EXISTS add_priority_column;

DELIMITER $$
CREATE PROCEDURE add_priority_column()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'complaints'
          AND COLUMN_NAME  = 'priority'
    ) THEN
        ALTER TABLE complaints
            ADD COLUMN priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium';
    END IF;
END$$
DELIMITER ;

CALL add_priority_column();

-- ============================================================
-- STEP 5: CREATE MISSING TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL UNIQUE,
    description TEXT          DEFAULT NULL,
    icon        VARCHAR(10)   DEFAULT '🏢',
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO departments (name, description, icon) VALUES
('Road Department',        'Handles road, pothole, and footpath issues',      '🛣️'),
('Water Department',       'Handles water supply and pipe leakage issues',    '💧'),
('Electricity Department', 'Handles street lights and power supply issues',   '⚡'),
('Sanitation Department',  'Handles garbage, drainage and cleanliness issues','🗑️'),
('General Department',     'Handles miscellaneous civic issues',              '🏛️');

CREATE TABLE IF NOT EXISTS complaint_timeline (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT         NOT NULL,
    changed_by   INT         DEFAULT NULL,
    old_status   VARCHAR(50) DEFAULT NULL,
    new_status   VARCHAR(50) NOT NULL,
    comment      TEXT        DEFAULT NULL,
    created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT          NOT NULL,
    complaint_id INT          DEFAULT NULL,
    title        VARCHAR(200) NOT NULL,
    message      TEXT         NOT NULL,
    type         ENUM('submitted','status_change','assigned','resolved','rejected','info') NOT NULL DEFAULT 'info',
    is_read      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STEP 6: CLEANUP PROCEDURES
-- ============================================================

DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DROP PROCEDURE IF EXISTS add_role_column;
DROP PROCEDURE IF EXISTS add_priority_column;

-- ============================================================
-- DONE
-- ============================================================
SELECT 'Migration complete! ✅' AS status;
SELECT name, email, role, is_active FROM users;
