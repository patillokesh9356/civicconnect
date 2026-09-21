-- ============================================================
-- CivicConnect - Smart Civic Complaint & Resolution System
-- Complete Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS civic_complaints_db;
USE civic_complaints_db;

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    email       VARCHAR(150)  NOT NULL UNIQUE,
    password    VARCHAR(255)  NOT NULL,
    phone       VARCHAR(20)   DEFAULT NULL,
    address     TEXT          DEFAULT NULL,
    role        ENUM('citizen','admin','department_officer') NOT NULL DEFAULT 'citizen',
    department_id INT         DEFAULT NULL,   -- only for department_officer
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. DEPARTMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL UNIQUE,
    description TEXT          DEFAULT NULL,
    icon        VARCHAR(10)   DEFAULT '🏢',
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default departments
INSERT IGNORE INTO departments (name, description, icon) VALUES
('Road Department',        'Handles road, pothole, and footpath issues',      '🛣️'),
('Water Department',       'Handles water supply and pipe leakage issues',    '💧'),
('Electricity Department', 'Handles street lights and power supply issues',   '⚡'),
('Sanitation Department',  'Handles garbage, drainage and cleanliness issues','🗑️'),
('General Department',     'Handles miscellaneous civic issues',              '🏛️');

-- ============================================================
-- 3. COMPLAINTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT           NOT NULL,
    title           VARCHAR(200)  NOT NULL,
    description     TEXT          NOT NULL,
    category        VARCHAR(100)  DEFAULT 'Other',
    location        VARCHAR(255)  DEFAULT NULL,
    latitude        DECIMAL(10,8) DEFAULT NULL,
    longitude       DECIMAL(11,8) DEFAULT NULL,
    status          ENUM('Pending','Assigned','In Progress','Resolved','Rejected')
                    NOT NULL DEFAULT 'Pending',
    priority        ENUM('Low','Medium','High','Critical')
                    NOT NULL DEFAULT 'Medium',
    department_id   INT           DEFAULT NULL,
    assigned_to     INT           DEFAULT NULL,   -- department_officer user id
    ai_category     VARCHAR(100)  DEFAULT NULL,   -- AI suggested category
    ai_priority     VARCHAR(50)   DEFAULT NULL,   -- AI suggested priority
    ai_summary      TEXT          DEFAULT NULL,   -- AI short summary
    ai_suggestion   TEXT          DEFAULT NULL,   -- AI solution suggestion
    is_duplicate    BOOLEAN       NOT NULL DEFAULT FALSE,
    duplicate_of    INT           DEFAULT NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at     DATETIME      DEFAULT NULL,

    FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to)   REFERENCES users(id)       ON DELETE SET NULL
);

-- ============================================================
-- 4. COMPLAINT TIMELINE / HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS complaint_timeline (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id    INT           NOT NULL,
    changed_by      INT           DEFAULT NULL,   -- user id who made change
    old_status      VARCHAR(50)   DEFAULT NULL,
    new_status      VARCHAR(50)   NOT NULL,
    comment         TEXT          DEFAULT NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by)   REFERENCES users(id)      ON DELETE SET NULL
);

-- ============================================================
-- 5. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT           NOT NULL,
    complaint_id    INT           DEFAULT NULL,
    title           VARCHAR(200)  NOT NULL,
    message         TEXT          NOT NULL,
    type            ENUM('submitted','status_change','assigned','resolved','rejected','info')
                    NOT NULL DEFAULT 'info',
    is_read         BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)      REFERENCES users(id)       ON DELETE CASCADE,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id)  ON DELETE SET NULL
);

-- ============================================================
-- 6. DEFAULT ADMIN USER
-- (password = "Admin@123" - bcrypt hashed, change after first login)
-- ============================================================
INSERT IGNORE INTO users (name, email, password, role) VALUES
('Admin', 'admin@civicconnect.com',
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniMnx7s7vLiqBpwOoyCaLTW7i',
 'admin');

-- ============================================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_complaints_user_id     ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status      ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category    ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_department  ON complaints(department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read  ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_timeline_complaint_id  ON complaint_timeline(complaint_id);
