// File: backend/src/modules/migration/utils/apply-current-revision.util.ts
// Change Log:
// - 2026-09-23: สร้างใหม่ — แยก "เลือก current revision + flip isCurrent" ออกมา
//   จาก migration.service.ts (importCorrespondence) และ migration-review.service.ts
//   (commitRecord) ที่ copy-paste logic นี้เหมือนกันเป๊ะทั้งสองที่ (ADR-002 review
//   finding #11) — แก้จุดเดียวพอ ไม่ต้องจำแก้สองที่พร้อมกัน

import { EntityManager } from 'typeorm';
import { CorrespondenceRevision } from '../../correspondence/entities/correspondence-revision.entity';
import { pickCurrentRevision } from './pick-current-revision.util';

/**
 * เลือก current revision จาก existingRevisions + revision ที่เพิ่ง upsert
 * (label สูงสุดตาม normalized ordering, order-independent) แล้ว flip isCurrent
 * flag ใน DB — ข้าม UPDATE ทั้งคู่เมื่อ current ไม่เปลี่ยน (เช่น re-commit/
 * re-import idempotent) เพื่อลด write-lock churn บน correspondence_revisions
 * โดยไม่จำเป็น
 */
export async function applyCurrentRevision(
  manager: EntityManager,
  correspondenceId: number,
  existingRevisions: readonly CorrespondenceRevision[],
  upsertedRevision: CorrespondenceRevision
): Promise<CorrespondenceRevision> {
  const allRevisions = existingRevisions.some(
    (r) => r.id === upsertedRevision.id
  )
    ? existingRevisions
    : [...existingRevisions, upsertedRevision];
  const currentRevision = pickCurrentRevision(allRevisions);
  const previousCurrent = existingRevisions.find((r) => r.isCurrent);
  if (previousCurrent?.id !== currentRevision.id) {
    await manager.update(
      CorrespondenceRevision,
      { correspondenceId },
      { isCurrent: false }
    );
    await manager.update(
      CorrespondenceRevision,
      { id: currentRevision.id },
      { isCurrent: true }
    );
  }
  return currentRevision;
}
