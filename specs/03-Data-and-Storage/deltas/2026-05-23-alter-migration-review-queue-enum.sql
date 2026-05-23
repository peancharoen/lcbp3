-- File: specs/03-Data-and-Storage/deltas/2026-05-23-alter-migration-review-queue-enum.sql
-- Change Log:
-- - 2026-05-23: เพิ่ม PENDING_REVIEW เข้า status ENUM ของ migration_review_queue (TypeORM-managed)
--              n8n workflow ไม่ใช้ MySQL direct access แล้ว — ใช้ POST /api/ai/migration/queue/record แทน (ADR-023A)
-- Delta: เพิ่ม PENDING_REVIEW ใน status column ของ migration_review_queue
-- Date: 2026-05-23
-- Related: ADR-028, ADR-023A
-- รันก่อน deploy backend ที่มี PENDING_REVIEW ใน MigrationReviewRecordStatus enum
ALTER TABLE migration_review_queue
MODIFY COLUMN STATUS ENUM(
    'PENDING',
    'PENDING_REVIEW',
    'IMPORTED',
    'REJECTED'
  ) DEFAULT 'PENDING';
