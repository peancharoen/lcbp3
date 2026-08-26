// File: backend/src/modules/migration/utils/attachment-linking.util.ts
// Change Log:
// - 2026-08-26: Initial creation — สกัดเมธอดกลางสำหรับเชื่อม attachments เข้า revision
//   ผ่าน junction table เพื่อป้องกัน code duplication ระหว่าง importCorrespondence
//   และ commitRecord (Architectural Prevention Recommendation)

import { EntityManager } from 'typeorm';

/**
 * ชื่อคอลัมน์ junction table จริงใน schema — เก็บเป็น constant เดียวเพื่อป้องกัน
 * การพิมพ์ผิด (เคยเกิด bug จากการใช้ "revision_id" แทน "correspondence_revision_id")
 */
const JUNCTION_TABLE = 'correspondence_revision_attachments';
const COL_REVISION_ID = 'correspondence_revision_id';
const COL_ATTACHMENT_ID = 'attachment_id';
const COL_IS_MAIN_DOCUMENT = 'is_main_document';

/**
 * เชื่อม attachments ทั้งหมดเข้ากับ correspondence revision ผ่าน junction table
 * (correspondence_revision_attachments) — ใช้ร่วมกันระหว่าง importCorrespondence
 * และ commitRecord เพื่อป้องกัน code duplication และ column name drift
 *
 * Anti-pattern note: เมธอดนี้ต้องถูกเรียกภายใน queryRunner transaction เดียวกับ
 * การสร้าง attachment และ revision — ห้ามใช้ default connection (auto-commit)
 * เพราะจะทำให้เกิด MariaDB error 1020 "Record has changed since last read"
 * เมื่อ transaction พยายามอ่าน/เขียนแถวที่ถูกแก้โดย connection อื่น
 *
 * @param manager EntityManager จาก queryRunner (ต้องเป็น transaction manager เท่านั้น)
 * @param revisionId Internal INT id ของ correspondence_revisions
 * @param attachmentIds รายการ internal INT ids ของ attachments (ลำดับแรก = เอกสารหลัก)
 *
 * FR-001, FR-002, FR-003: element [0] คือเอกสารหลัก (is_main_document=1),
 * ที่เหลือเป็นเอกสารรอง (is_main_document=0)
 */
export async function linkAttachmentsToRevision(
  manager: EntityManager,
  revisionId: number,
  attachmentIds: number[]
): Promise<void> {
  for (let i = 0; i < attachmentIds.length; i += 1) {
    await manager.query(
      `INSERT IGNORE INTO ${JUNCTION_TABLE} (${COL_REVISION_ID}, ${COL_ATTACHMENT_ID}, ${COL_IS_MAIN_DOCUMENT}) VALUES (?, ?, ?)`,
      [revisionId, attachmentIds[i], i === 0 ? 1 : 0]
    );
  }
}
