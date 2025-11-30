-- ==========================================================
-- DMS v0.5.0
-- Database v5.1 - Deploy Script Schema (Revised)
-- Server: Container Station on QNAP TS-473A
-- Database service: MariaDB 10.11
-- Notes:
-- - Removed 'rfas' table.
-- - Added 'contracts' and 'contract_parties' tables.
-- ==========================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET FOREIGN_KEY_CHECKS=0;

-- Drop tables in reverse order of creation due to dependencies
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS user_project_roles;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS project_parties;
DROP TABLE IF EXISTS contract_parties; -- New
DROP TABLE IF EXISTS contracts; -- New
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS correspondence_references;
DROP TABLE IF EXISTS correspondence_cc_recipients;
DROP TABLE IF EXISTS correspondences;
DROP TABLE IF EXISTS email_details;
DROP TABLE IF EXISTS instruction_details;
DROP TABLE IF EXISTS letter_details;
DROP TABLE IF EXISTS memorandum_details;
DROP TABLE IF EXISTS minutes_of_meeting_details;
DROP TABLE IF EXISTS rfi_details;
DROP TABLE IF EXISTS rfa_items;
DROP TABLE IF EXISTS transmittal_items;
DROP TABLE IF EXISTS transmittals;
DROP TABLE IF EXISTS technicaldocs;
DROP TABLE IF EXISTS shop_drawing_revisions;
DROP TABLE IF EXISTS shop_drawings;
DROP TABLE IF EXISTS shop_drawing_sub_categories;
DROP TABLE IF EXISTS shop_drawing_main_categories;
DROP TABLE IF EXISTS contract_dwg_subcat_cat_map;
DROP TABLE IF EXISTS contract_dwg_sub_cat;
DROP TABLE IF EXISTS contract_dwg_cat;
DROP TABLE IF EXISTS contract_drawings;
DROP TABLE IF EXISTS cir_action_documents;
DROP TABLE IF EXISTS cir_actions;
DROP TABLE IF EXISTS cir_recipients;
DROP TABLE IF EXISTS circulations;
DROP TABLE IF EXISTS cir_status_codes;
DROP TABLE IF EXISTS correspondence_status_transitions;
DROP TABLE IF EXISTS correspondence_statuses;
DROP TABLE IF EXISTS correspondence_types;
DROP TABLE IF EXISTS correspondence_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS global_default_roles;

SET FOREIGN_KEY_CHECKS=1;

-- ==========================================================
-- Table Creation
-- ==========================================================

-- Organizations Table
CREATE TABLE organizations (
  org_id        INT NOT NULL AUTO_INCREMENT,
  org_code      VARCHAR(20) NOT NULL,
  org_name      VARCHAR(255) NOT NULL,
  primary_role  ENUM('OWNER','DESIGNER','CONSULTANT','CONTRACTOR') NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (org_id),
  UNIQUE KEY ux_organizations_code (org_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Projects Table
CREATE TABLE projects (
  project_id    INT NOT NULL AUTO_INCREMENT,
  project_code  VARCHAR(20) NOT NULL,
  project_name  VARCHAR(255) NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id),
  UNIQUE KEY ux_projects_code (project_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- NEW: Contracts Table
-- Stores information about each contract.
CREATE TABLE contracts (
  contract_id   INT NOT NULL AUTO_INCREMENT,
  contract_code VARCHAR(50) NOT NULL,
  contract_name VARCHAR(255) NOT NULL,
  description   TEXT,
  start_date    DATE,
  end_date      DATE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (contract_id),
  UNIQUE KEY ux_contracts_code (contract_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- NEW: Contract Parties Table
-- Links contracts, projects, and organizations together.
CREATE TABLE contract_parties (
  contract_id INT NOT NULL,
  project_id  INT NOT NULL,
  org_id      INT NOT NULL,
  PRIMARY KEY (contract_id, project_id, org_id),
  CONSTRAINT fk_cp_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cp_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cp_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- Users Table (RBAC)
CREATE TABLE users (
  user_id       INT NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email         VARCHAR(100) NOT NULL,
  first_name    VARCHAR(50),
  last_name     VARCHAR(50),
  org_id        INT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY ux_users_username (username),
  UNIQUE KEY ux_users_email (email),
  CONSTRAINT fk_users_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Roles Table (RBAC)
CREATE TABLE roles (
  role_id       INT NOT NULL AUTO_INCREMENT,
  role_code     VARCHAR(50) NOT NULL,
  role_name     VARCHAR(100) NOT NULL,
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (role_id),
  UNIQUE KEY ux_roles_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Permissions Table (RBAC)
CREATE TABLE permissions (
  permission_id   INT NOT NULL AUTO_INCREMENT,
  permission_code VARCHAR(100) NOT NULL,
  description     TEXT,
  PRIMARY KEY (permission_id),
  UNIQUE KEY ux_permissions_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Role Permissions Junction Table (RBAC)
CREATE TABLE role_permissions (
  role_id         INT NOT NULL,
  permission_id   INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- User Roles Junction Table (RBAC) - For global/system-level roles
CREATE TABLE user_roles (
  user_id       INT NOT NULL,
  role_id       INT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- User Project Roles Junction Table (RBAC) - For project-specific roles
CREATE TABLE user_project_roles (
  user_id       INT NOT NULL,
  project_id    INT NOT NULL,
  role_id       INT NOT NULL,
  PRIMARY KEY (user_id, project_id, role_id),
  CONSTRAINT fk_upr_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_upr_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_upr_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Project Parties Table
CREATE TABLE project_parties (
  project_id    INT NOT NULL,
  org_id        INT NOT NULL,
  role          ENUM('OWNER','DESIGNER','CONSULTANT','CONTRACTOR') NOT NULL,
  is_contractor TINYINT(1) GENERATED ALWAYS AS (IF(role = 'CONTRACTOR', 1, NULL)) STORED,
  PRIMARY KEY (project_id, org_id),
  UNIQUE KEY uq_project_parties_contractor (project_id, is_contractor),
  CONSTRAINT fk_pp_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pp_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ... (The rest of your original script for correspondences, technical docs, etc. remains here) ...

-- Global default roles (template defaults)
CREATE TABLE global_default_roles (
  id        TINYINT NOT NULL DEFAULT 1,
  role      ENUM('OWNER','DESIGNER','CONSULTANT') NOT NULL,
  position  TINYINT NOT NULL,
  org_id    INT NOT NULL,
  PRIMARY KEY (id, role, position),
  UNIQUE KEY ux_gdr_unique_org_per_role (id, role, org_id),
  CONSTRAINT fk_gdr_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ... (The rest of your original script continues from here) ...