-- ==========================================================
-- Delta: อัปเดต COLUMN COMMENT ของ uuid/public_id ทุกตาราง
-- เพื่อระบุ UUIDv1/v7 ชัดเจนตาม ADR-019
-- Date: 2026-08-20
-- Author: Devin (assisted)
-- ADR: ADR-019 (Hybrid Identifier Strategy), ADR-044 (Schema Strategy)
-- Impact: Metadata-only (COMMENT) — ไม่มีการเปลี่ยนแปลงโครงสร้างหรือข้อมูล
-- Tables affected: 28 tables (uuid/public_id columns) + 4 tables (id CHAR(36) PK) + 3 tables (FK columns)
-- ==========================================================
-- หมายเหตุ:
--   • ALTER TABLE ... MODIFY COLUMN เปลี่ยนเฉพาะ COMMENT — ไม่กระทบ index/PK/FK
--   • ไม่ระบุ UNIQUE/PRIMARY KEY ใน MODIFY COLUMN เพื่อ preserve index เดิม
--   • Single quote ใน COMMENT escape เป็น '' (SQL standard)
-- ==========================================================

-- =====================================================
-- 1. uuid/public_id ที่มี DEFAULT UUID() (UUIDv7 runtime + UUIDv1 fallback)
--    คอลัมน์เดิมมี comment "UUID Public Identifier (ADR-019)"
-- ==========================================================

ALTER TABLE `organizations` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `projects` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `contracts` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `users` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `roles` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `correspondences` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `correspondence_revisions` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `contract_drawings` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `shop_drawings` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `shop_drawing_revisions` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `asbuilt_drawings` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `asbuilt_drawing_revisions` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `circulations` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `attachments` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `notifications` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `migration_logs` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `migration_review_queue` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `ai_audit_logs` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `ai_intent_definitions` MODIFY COLUMN `public_id` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `ai_intent_patterns` MODIFY COLUMN `public_id` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';

-- =====================================================
-- 2. uuid ที่มี DEFAULT UUID() แต่เดิมไม่มี comment (ว่าง)
--    ตารางใหม่ v1.9.0 (RFA Approval System)
-- ==========================================================

ALTER TABLE `review_teams` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `review_team_members` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `response_codes` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `response_code_rules` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `review_tasks` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `delegations` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `reminder_rules` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `distribution_matrices` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';
ALTER TABLE `distribution_recipients` MODIFY COLUMN `uuid` UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)';

-- =====================================================
-- 3. public_id ที่ไม่มี DEFAULT (app layer สร้าง UUIDv7 เสมอ)
-- ==========================================================

ALTER TABLE `ai_prompts` MODIFY COLUMN `public_id` UUID NOT NULL COMMENT 'UUIDv7 (NestJS @BeforeInsert, ADR-019) — app layer สร้างเสมอ (ไม่มี DB DEFAULT)';

-- =====================================================
-- 4. id CHAR(36) PK ของ workflow tables (UUIDv4 — TypeORM @PrimaryGeneratedColumn)
--    ไม่ใช่ ADR-019 publicId
-- ==========================================================

ALTER TABLE `workflow_definitions` MODIFY COLUMN `id` CHAR(36) NOT NULL COMMENT 'UUIDv4 (TypeORM @PrimaryGeneratedColumn(''uuid'') — ไม่ใช่ ADR-019 publicId) ของ Workflow Definition';
ALTER TABLE `workflow_instances` MODIFY COLUMN `id` CHAR(36) NOT NULL COMMENT 'UUIDv4 (TypeORM @PrimaryGeneratedColumn(''uuid'') — ไม่ใช่ ADR-019 publicId) ของ Instance';
ALTER TABLE `workflow_histories` MODIFY COLUMN `id` CHAR(36) NOT NULL COMMENT 'UUIDv4 (TypeORM @PrimaryGeneratedColumn(''uuid'') — ไม่ใช่ ADR-019 publicId)';
ALTER TABLE `document_chunks` MODIFY COLUMN `id` CHAR(36) NOT NULL COMMENT 'UUIDv4 = Qdrant point ID (TypeORM @PrimaryGeneratedColumn(''uuid'') สำหรับ ai_document_chunks หรือ UUID ที่ Qdrant assign)';

-- =====================================================
-- 5. FK columns ที่อ้างอิง UUID (ระบุที่มา v1/v7)
-- ==========================================================

ALTER TABLE `ai_audit_logs` MODIFY COLUMN `document_public_id` UUID NULL COMMENT 'Imported document publicId (UUIDv7 หรือ UUIDv1 ตามที่มาของ document) when available';
ALTER TABLE `distribution_recipients` MODIFY COLUMN `recipient_public_id` UUID NOT NULL COMMENT 'publicId ของ target entity (UUIDv7 หรือ UUIDv1 ตามที่มาของ record): USER=users.uuid | ORGANIZATION=organizations.uuid | TEAM=review_teams.uuid | ROLE=roles.uuid';
ALTER TABLE `workflow_histories` MODIFY COLUMN `action_by_user_uuid` VARCHAR(36) NULL COMMENT 'UUID ของ User ผู้ดำเนินการ (คัดลอกจาก users.uuid — อาจเป็น UUIDv7 หรือ UUIDv1 ตามที่มาของ user record) — ใช้ใน API Response แทน INT FK (ADR-019). NULL = System Action หรือ Pre-migration record';

-- =====================================================
-- Verification (รันหลัง apply delta):
--   SELECT TABLE_NAME, COLUMN_NAME, COLUMN_COMMENT
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = 'lcbp3'
--     AND COLUMN_COMMENT LIKE '%UUID Public Identifier (ADR-019)%';
--   -- ควรคืน 0 rows (ไม่มี comment เก่าเหลือ)
-- ==========================================================
