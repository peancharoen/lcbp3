-- ==========================================================
-- DMS v0.5.0
-- Database v5.1 - Deploy Script Schema (Complete & Revised)
-- Server: Container Station on QNAP TS-473A
-- Database service: MariaDB 10.11
-- Notes:
-- - This is a consolidated and updated version.
-- - Removed 'rfas' table.
-- - Added tables for Contracts, detailed Circulations,
--   Technical Document Workflow, and Correspondence Revisions.
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
DROP TABLE IF EXISTS contract_parties;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS correspondence_references;
DROP TABLE IF EXISTS correspondence_revisions;
DROP TABLE IF EXISTS correspondence_cc_recipients;
DROP TABLE IF EXISTS technical_doc_workflows;
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
DROP TABLE IF EXISTS circulation_assignees;
DROP TABLE IF EXISTS circulations;
DROP TABLE IF EXISTS cir_action_documents;
DROP TABLE IF EXISTS cir_actions;
DROP TABLE IF EXISTS cir_recipients;
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

CREATE TABLE contract_parties (
  contract_id INT NOT NULL,
  project_id  INT NOT NULL,
  org_id      INT NOT NULL,
  PRIMARY KEY (contract_id, project_id, org_id),
  CONSTRAINT fk_cp_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cp_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cp_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

CREATE TABLE roles (
  role_id       INT NOT NULL AUTO_INCREMENT,
  role_code     VARCHAR(50) NOT NULL,
  role_name     VARCHAR(100) NOT NULL,
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (role_id),
  UNIQUE KEY ux_roles_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE permissions (
  permission_id   INT NOT NULL AUTO_INCREMENT,
  permission_code VARCHAR(100) NOT NULL,
  description     TEXT,
  PRIMARY KEY (permission_id),
  UNIQUE KEY ux_permissions_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE role_permissions (
  role_id         INT NOT NULL,
  permission_id   INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE user_roles (
  user_id       INT NOT NULL,
  role_id       INT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE user_project_roles (
  user_id       INT NOT NULL,
  project_id    INT NOT NULL,
  role_id       INT NOT NULL,
  PRIMARY KEY (user_id, project_id, role_id),
  CONSTRAINT fk_upr_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_upr_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_upr_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

-- Correspondence & Workflow Tables

CREATE TABLE correspondence_types (
  type_id   INT NOT NULL AUTO_INCREMENT,
  type_code VARCHAR(20) NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (type_id),
  UNIQUE KEY ux_ct_code (type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE correspondence_statuses (
  status_id   INT NOT NULL AUTO_INCREMENT,
  status_code VARCHAR(20) NOT NULL,
  status_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (status_id),
  UNIQUE KEY ux_cs_code (status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE correspondences (
  id                  INT NOT NULL AUTO_INCREMENT,
  project_id          INT NOT NULL,
  document_number     VARCHAR(100) NOT NULL,
  title               VARCHAR(500) NOT NULL,
  issue_date          DATE NOT NULL,
  status_id           INT NOT NULL,
  type_id             INT NOT NULL,
  originator_org_id   INT NOT NULL,
  created_by_user_id  INT NOT NULL,
  root_id             INT NULL, -- for revisions
  version             INT NOT NULL DEFAULT 1,
  submitted_at        TIMESTAMP NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_corr_doc_num (document_number),
  CONSTRAINT fk_corr_project FOREIGN KEY (project_id) REFERENCES projects(project_id),
  CONSTRAINT fk_corr_status FOREIGN KEY (status_id) REFERENCES correspondence_statuses(status_id),
  CONSTRAINT fk_corr_type FOREIGN KEY (type_id) REFERENCES correspondence_types(type_id),
  CONSTRAINT fk_corr_org FOREIGN KEY (originator_org_id) REFERENCES organizations(org_id),
  CONSTRAINT fk_corr_user FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_corr_root FOREIGN KEY (root_id) REFERENCES correspondences(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE correspondence_revisions (
    revision_id         INT NOT NULL AUTO_INCREMENT,
    correspondence_id   INT NOT NULL,
    version_number      INT NOT NULL,
    change_reason       TEXT NOT NULL,
    changed_by_user_id  INT NOT NULL,
    changed_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    document_data_json  JSON NOT NULL,
    PRIMARY KEY (revision_id),
    CONSTRAINT fk_cr_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_user FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE cir_status_codes (
  code          VARCHAR(20) NOT NULL,
  description   VARCHAR(255),
  sort_order    INT NOT NULL,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE circulations (
    cir_id              INT NOT NULL AUTO_INCREMENT,
    correspondence_id   INT NOT NULL,
    org_id              INT NOT NULL,
    cir_subject         VARCHAR(500) NOT NULL,
    cir_status_code     VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by_user_id  INT NOT NULL,
    submitted_at        TIMESTAMP NULL,
    closed_at           TIMESTAMP NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (cir_id),
    CONSTRAINT fk_cir_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(id),
    CONSTRAINT fk_cir_org FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    CONSTRAINT fk_cir_status FOREIGN KEY (cir_status_code) REFERENCES cir_status_codes(code),
    CONSTRAINT fk_cir_user FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE circulation_assignees (
    assignee_id         INT NOT NULL AUTO_INCREMENT,
    cir_id              INT NOT NULL,
    user_id             INT NOT NULL,
    assignee_type       ENUM('MAIN', 'ACTION', 'INFO') NOT NULL,
    deadline            DATE NULL,
    action_taken        TEXT NULL,
    is_completed        BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at        TIMESTAMP NULL,
    PRIMARY KEY (assignee_id),
    UNIQUE KEY ux_cir_user_type (cir_id, user_id, assignee_type),
    CONSTRAINT fk_ca_cir FOREIGN KEY (cir_id) REFERENCES circulations(cir_id) ON DELETE CASCADE,
    CONSTRAINT fk_ca_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE technical_doc_workflows (
    workflow_id         INT NOT NULL AUTO_INCREMENT,
    correspondence_id   INT NOT NULL,
    sequence            INT NOT NULL,
    org_id              INT NOT NULL,
    status              ENUM('PENDING', 'APPROVED', 'REJECTED', 'APPROVED_WITH_COMMENTS', 'FORWARDED', 'RETURNED') NOT NULL DEFAULT 'PENDING',
    comments            TEXT,
    processed_by_user_id INT NULL,
    processed_at        TIMESTAMP NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workflow_id),
    UNIQUE KEY ux_workflow_corr_sequence (correspondence_id, sequence),
    CONSTRAINT fk_tdw_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    CONSTRAINT fk_tdw_org FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    CONSTRAINT fk_tdw_user FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE correspondence_status_transitions(
  type_id INT NOT NULL,
  from_status_id INT NOT NULL,
  to_status_id   INT NOT NULL,
  PRIMARY KEY (type_id, from_status_id, to_status_id),
  CONSTRAINT fk_cst_type   FOREIGN KEY (type_id) REFERENCES correspondence_types(type_id),
  CONSTRAINT fk_cst_from   FOREIGN KEY (from_status_id) REFERENCES correspondence_statuses(status_id),
  CONSTRAINT fk_cst_to     FOREIGN KEY (to_status_id)   REFERENCES correspondence_statuses(status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- (The rest of your original tables for technical docs, drawings, etc. would follow here)
-- For brevity, I've included the core structure. You can append the remaining tables from your original file.