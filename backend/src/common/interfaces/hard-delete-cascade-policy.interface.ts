// File: backend/src/common/interfaces/hard-delete-cascade-policy.interface.ts
// บันทึกการแก้ไข: Cascade policy interface for hard-delete (Feature 253)

import { QueryRunner } from 'typeorm';

/**
 * นโยบายการลบแบบ cascade สำหรับเอกสารแต่ละประเภท
 * กำหนดว่าต้องลบ child entities อะไรบ้าง และไฟล์/เวกเตอร์ใดที่ต้องลบตาม
 */
export interface HardDeleteCascadePolicy {
  /**
   * ลบ child entities ที่เกี่ยวข้องกับเอกสารภายใน transaction เดียวกัน
   * คืน projectPublicId สำหรับ Qdrant vector deletion (FR-011)
   */
  deleteRelated(
    publicId: string,
    queryRunner: QueryRunner
  ): Promise<{ filesToDelete: string[]; projectPublicId?: string }>;

  /**
   * รายการไฟล์ที่ต้องลบจาก Storage (หลัง commit)
   */
  getStorageFiles(publicId: string): Promise<string[]>;

  /**
   * ลบเวกเตอร์ค้นหา (post-commit, retry 3 ครั้ง)
   */
  deleteVectors(publicId: string): Promise<void>;
}
