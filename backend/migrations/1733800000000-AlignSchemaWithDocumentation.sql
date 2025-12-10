-- Migration: Align Schema with Documentation
-- Version: 1733800000000
-- Date: 2025-12-10
-- Description: Add missing fields and fix column lengths to match schema v1.5.1
-- ==========================================================
-- Phase 1: Organizations Table Updates
-- ==========================================================
-- Add role_id column to organizations
ALTER TABLE organizations
ADD COLUMN role_id INT NULL COMMENT 'Reference to organization_roles table';

-- Add foreign key constraint
ALTER TABLE organizations
ADD CONSTRAINT fk_organizations_role FOREIGN KEY (role_id) REFERENCES organization_roles(id) ON DELETE
SET NULL;

-- Modify organization_name length from 200 to 255
ALTER TABLE organizations
MODIFY COLUMN organization_name VARCHAR(255) NOT NULL COMMENT 'Organization name';

-- ==========================================================
-- Phase 2: Users Table Updates (Security Fields)
-- ==========================================================
-- Add failed_attempts for login tracking
ALTER TABLE users
ADD COLUMN failed_attempts INT DEFAULT 0 COMMENT 'Number of failed login attempts';

-- Add locked_until for account lockout mechanism
ALTER TABLE users
ADD COLUMN locked_until DATETIME NULL COMMENT 'Account locked until this timestamp';

-- Add last_login_at for audit trail
ALTER TABLE users
ADD COLUMN last_login_at TIMESTAMP NULL COMMENT 'Last successful login timestamp';

-- ==========================================================
-- Phase 3: Roles Table Updates
-- ==========================================================
-- Modify role_name length from 50 to 100
ALTER TABLE roles
MODIFY COLUMN role_name VARCHAR(100) NOT NULL COMMENT 'Role name';

-- ==========================================================
-- Verification Queries
-- ==========================================================
-- Verify organizations table structure
SELECT COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'organizations'
ORDER BY ORDINAL_POSITION;

-- Verify users table has new security fields
SELECT COLUMN_NAME,
  DATA_TYPE,
  COLUMN_DEFAULT,
  IS_NULLABLE,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME IN (
    'failed_attempts',
    'locked_until',
    'last_login_at'
  )
ORDER BY ORDINAL_POSITION;

-- Verify roles table role_name length
SELECT COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'roles'
  AND COLUMN_NAME = 'role_name';

-- ==========================================================
-- Rollback Script (Use if needed)
-- ==========================================================
/*
 -- Rollback Phase 3: Roles
 ALTER TABLE roles
 MODIFY COLUMN role_name VARCHAR(50) NOT NULL;
 
 -- Rollback Phase 2: Users
 ALTER TABLE users
 DROP COLUMN last_login_at,
 DROP COLUMN locked_until,
 DROP COLUMN failed_attempts;
 
 -- Rollback Phase 1: Organizations
 ALTER TABLE organizations
 MODIFY COLUMN organization_name VARCHAR(200) NOT NULL;
 
 ALTER TABLE organizations
 DROP FOREIGN KEY fk_organizations_role;
 
 ALTER TABLE organizations
 DROP COLUMN role_id;
 */
