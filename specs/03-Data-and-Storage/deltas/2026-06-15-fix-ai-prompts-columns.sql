-- Delta: 2026-06-15-fix-ai-prompts-columns.sql
-- Fix: (1) Drop duplicate camelCase publicId column (TypeORM mapping bug)
--      (2) Add version column for optimistic locking (T066)
-- ADR-009: Edit schema directly, no TypeORM migrations

-- ลบ duplicate column ที่ TypeORM สร้างผิด (camelCase แทน snake_case)
ALTER TABLE ai_prompts DROP COLUMN IF EXISTS `publicId`;

-- เพิ่ม version column สำหรับ @VersionColumn (optimistic locking)
ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 1;
