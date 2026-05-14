-- =============================================================================
-- LCBP3-DMS v1.9.0 — RFA Approval System Refactor Schema
-- Feature Branch: 204-rfa-approval-refactor
-- ADR-009: No TypeORM migrations — edit SQL schema directly
-- Created: 2026-05-13
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. review_teams — ทีมตรวจสอบแยกตาม Discipline
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `review_teams` (
  `id`                    INT             NOT NULL AUTO_INCREMENT,
  `uuid`                  UUID            NOT NULL DEFAULT (UUID()),
  `project_id`            INT             NOT NULL,
  `name`                  VARCHAR(100)    NOT NULL,
  `description`           VARCHAR(255)    NULL,
  `default_for_rfa_types` TEXT            NULL COMMENT 'Comma-separated RFA type codes e.g. SDW,DDW',
  `is_active`             TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_teams_uuid` (`uuid`),
  KEY `idx_review_teams_project` (`project_id`, `is_active`),
  CONSTRAINT `fk_review_teams_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. review_team_members — สมาชิกในทีมแยกตาม Discipline
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `review_team_members` (
  `id`              INT             NOT NULL AUTO_INCREMENT,
  `uuid`            UUID            NOT NULL DEFAULT (UUID()),
  `team_id`         INT             NOT NULL,
  `user_id`         INT             NOT NULL,
  `discipline_id`   INT             NOT NULL,
  `role`            ENUM('REVIEWER','LEAD','MANAGER') NOT NULL DEFAULT 'REVIEWER',
  `priority_order`  INT             NOT NULL DEFAULT 0,
  `created_at`      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_team_members_uuid` (`uuid`),
  UNIQUE KEY `uq_team_user_discipline` (`team_id`, `user_id`, `discipline_id`),
  KEY `idx_rtm_team` (`team_id`),
  KEY `idx_rtm_user` (`user_id`),
  CONSTRAINT `fk_rtm_team` FOREIGN KEY (`team_id`) REFERENCES `review_teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rtm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rtm_discipline` FOREIGN KEY (`discipline_id`) REFERENCES `disciplines` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. response_codes — รหัสตอบกลับมาตรฐาน (Master Approval Matrix)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `response_codes` (
  `id`              INT             NOT NULL AUTO_INCREMENT,
  `uuid`            UUID            NOT NULL DEFAULT (UUID()),
  `code`            VARCHAR(10)     NOT NULL COMMENT '1A, 1B, 1C, 1D, 1E, 1F, 1G, 2, 3, 4',
  `sub_status`      VARCHAR(10)     NULL,
  `category`        ENUM('ENGINEERING','MATERIAL','CONTRACT','TESTING','ESG') NOT NULL,
  `description_th`  TEXT            NOT NULL,
  `description_en`  TEXT            NOT NULL,
  `implications`    JSON            NULL COMMENT '{"affectsSchedule":bool,"affectsCost":bool,"requiresContractReview":bool}',
  `notify_roles`    TEXT            NULL COMMENT 'Comma-separated roles e.g. CONTRACT_MANAGER,QS_MANAGER',
  `is_active`       TINYINT(1)      NOT NULL DEFAULT 1,
  `is_system`       TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'System default — cannot delete',
  `created_at`      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_response_codes_uuid` (`uuid`),
  UNIQUE KEY `uq_response_code_category` (`code`, `category`),
  KEY `idx_rc_category_active` (`category`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. response_code_rules — กฎการใช้รหัสต่อโครงการ/ประเภทเอกสาร
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `response_code_rules` (
  `id`                    INT         NOT NULL AUTO_INCREMENT,
  `uuid`                  UUID        NOT NULL DEFAULT (UUID()),
  `project_id`            INT         NULL COMMENT 'NULL = global default',
  `document_type_id`      INT         NOT NULL,
  `response_code_id`      INT         NOT NULL,
  `is_enabled`            TINYINT(1)  NOT NULL DEFAULT 1,
  `requires_comments`     TINYINT(1)  NOT NULL DEFAULT 0,
  `triggers_notification` TINYINT(1)  NOT NULL DEFAULT 0,
  `parent_rule_id`        INT         NULL COMMENT 'For inheritance tracking',
  `created_at`            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_response_code_rules_uuid` (`uuid`),
  UNIQUE KEY `uq_rule_per_project_doctype_code` (`project_id`, `document_type_id`, `response_code_id`),
  KEY `idx_response_rules_lookup` (`project_id`, `document_type_id`, `is_enabled`),
  CONSTRAINT `fk_rcr_response_code` FOREIGN KEY (`response_code_id`) REFERENCES `response_codes` (`id`),
  CONSTRAINT `fk_rcr_parent` FOREIGN KEY (`parent_rule_id`) REFERENCES `response_code_rules` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. review_tasks — งานตรวจสอบสำหรับแต่ละ Discipline (Parallel Review)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `review_tasks` (
  `id`                    INT             NOT NULL AUTO_INCREMENT,
  `uuid`                  UUID            NOT NULL DEFAULT (UUID()),
  `rfa_revision_id`       INT             NOT NULL,
  `team_id`               INT             NOT NULL,
  `discipline_id`         INT             NOT NULL,
  `assigned_to_user_id`   INT             NULL COMMENT 'NULL = auto-assign by discipline',
  `status`                ENUM('PENDING','IN_PROGRESS','COMPLETED','DELEGATED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `due_date`              DATE            NULL,
  `response_code_id`      INT             NULL,
  `comments`              TEXT            NULL,
  `attachments`           JSON            NULL COMMENT 'Array of attachment publicIds',
  `delegated_from_user_id` INT            NULL COMMENT 'Original assignee when delegated',
  `completed_at`          TIMESTAMP       NULL,
  `version`               INT             NOT NULL DEFAULT 1 COMMENT 'Optimistic locking (ADR-002)',
  `created_at`            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_tasks_uuid` (`uuid`),
  UNIQUE KEY `uq_review_task_per_revision_discipline` (`rfa_revision_id`, `team_id`, `discipline_id`),
  KEY `idx_review_tasks_rfa_revision` (`rfa_revision_id`),
  KEY `idx_review_tasks_status` (`status`),
  KEY `idx_review_tasks_assigned` (`assigned_to_user_id`, `status`),
  CONSTRAINT `fk_rt_rfa_revision` FOREIGN KEY (`rfa_revision_id`) REFERENCES `rfa_revisions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rt_team` FOREIGN KEY (`team_id`) REFERENCES `review_teams` (`id`),
  CONSTRAINT `fk_rt_discipline` FOREIGN KEY (`discipline_id`) REFERENCES `disciplines` (`id`),
  CONSTRAINT `fk_rt_user` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rt_response_code` FOREIGN KEY (`response_code_id`) REFERENCES `response_codes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. delegations — การมอบหมายงาน
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `delegations` (
  `id`                  INT             NOT NULL AUTO_INCREMENT,
  `uuid`                UUID            NOT NULL DEFAULT (UUID()),
  `delegator_user_id`   INT             NOT NULL COMMENT 'ผู้มอบหมาย (FK → users.user_id)',
  `delegate_user_id`    INT             NOT NULL COMMENT 'ผู้รับมอบหมาย (FK → users.user_id)',
  `start_date`          DATE            NOT NULL,
  `end_date`            DATE            NULL COMMENT 'BullMQ job flips is_active=0 when end_date < NOW() (ADR-008)',
  `scope`               ENUM('ALL','RFA_ONLY','CORRESPONDENCE_ONLY','SPECIFIC_TYPES') NOT NULL DEFAULT 'ALL',
  `document_types`      TEXT            NULL COMMENT 'Comma-separated doc type codes when scope=SPECIFIC_TYPES',
  `is_active`           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Managed by BullMQ scheduler — do not flip manually',
  `reason`              TEXT            NULL,
  `created_at`          DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`          DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_delegations_uuid` (`uuid`),
  KEY `idx_delegations_active` (`delegator_user_id`, `is_active`, `start_date`, `end_date`),
  KEY `idx_delegations_delegate` (`delegate_user_id`, `is_active`),
  CONSTRAINT `fk_del_delegator` FOREIGN KEY (`delegator_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_del_delegate` FOREIGN KEY (`delegate_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. reminder_rules — กฎการแจ้งเตือน
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reminder_rules` (
  `id`                        INT          NOT NULL AUTO_INCREMENT,
  `uuid`                      UUID         NOT NULL DEFAULT (UUID()),
  `name`                      VARCHAR(100) NOT NULL,
  `project_id`                INT          NULL COMMENT 'NULL = global',
  `document_type_id`          INT          NULL COMMENT 'NULL = all types',
  `trigger_days_before_due`   INT          NOT NULL DEFAULT 2,
  `escalation_days_after_due` INT          NOT NULL DEFAULT 1,
  `reminder_type`             ENUM('DUE_SOON','ON_DUE','OVERDUE','ESCALATION_L1','ESCALATION_L2') NOT NULL,
  `recipients`                TEXT         NOT NULL COMMENT 'Comma-separated: ASSIGNEE,MANAGER,PROJECT_MANAGER',
  `message_template_th`       TEXT         NOT NULL,
  `message_template_en`       TEXT         NOT NULL,
  `is_active`                 TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`                DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`                DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reminder_rules_uuid` (`uuid`),
  KEY `idx_reminder_rules_active` (`is_active`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. distribution_matrices — ตารางกระจายเอกสาร
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `distribution_matrices` (
  `id`                INT          NOT NULL AUTO_INCREMENT,
  `uuid`              UUID         NOT NULL DEFAULT (UUID()),
  `name`              VARCHAR(100) NOT NULL,
  `project_id`        INT          NULL COMMENT 'NULL = global',
  `document_type_id`  INT          NOT NULL,
  `response_code_id`  INT          NULL COMMENT 'NULL = applies to all codes',
  `conditions`        JSON         NULL COMMENT '{"codes":["1A","1B"],"excludeCodes":["3","4"]}',
  `is_active`         TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_distribution_matrices_uuid` (`uuid`),
  KEY `idx_distribution_lookup` (`document_type_id`, `response_code_id`, `is_active`),
  CONSTRAINT `fk_dm_response_code` FOREIGN KEY (`response_code_id`) REFERENCES `response_codes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. distribution_recipients — ผู้รับเอกสารใน Distribution Matrix
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `distribution_recipients` (
  `id`                    INT         NOT NULL AUTO_INCREMENT,
  `uuid`                  UUID        NOT NULL DEFAULT (UUID()) COMMENT 'UUID Public Identifier (ADR-019)',
  `matrix_id`             INT         NOT NULL,
  `recipient_type`        ENUM('USER','ORGANIZATION','TEAM','ROLE') NOT NULL,
  `recipient_public_id`   UUID        NOT NULL COMMENT 'publicId of target: USER=users.uuid | ORGANIZATION=organizations.uuid | TEAM=review_teams.uuid | ROLE=roles.uuid',
  `delivery_method`       ENUM('EMAIL','IN_APP','BOTH') NOT NULL DEFAULT 'BOTH',
  `sequence`              INT         NULL COMMENT 'For ordered delivery',
  `created_at`            DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_distribution_recipients_uuid` (`uuid`),
  KEY `idx_dr_matrix` (`matrix_id`),
  KEY `idx_dr_type_recipient` (`recipient_type`, `recipient_public_id`),
  CONSTRAINT `fk_dr_matrix` FOREIGN KEY (`matrix_id`) REFERENCES `distribution_matrices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Polymorphic recipients — no FK on recipient_public_id by design.';
