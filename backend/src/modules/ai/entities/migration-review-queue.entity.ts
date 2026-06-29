// File: src/modules/ai/entities/migration-review-queue.entity.ts
// Change Log
// - 2026-05-15: เพิ่ม re-export สำหรับชื่อ entity ตาม ADR-023A tasks.md โดยไม่สร้าง metadata ซ้ำ.

export {
  MigrationReviewRecord as MigrationReviewQueueEntity,
  MigrationReviewRecord,
  MigrationReviewRecordStatus,
} from './migration-review.entity';
