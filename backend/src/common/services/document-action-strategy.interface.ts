// File: backend/src/common/services/document-action-strategy.interface.ts
// บันทึกการแก้ไข: Strategy interface for document actions (Feature 253 — T005)

import { QueryRunner } from 'typeorm';
import { ActionResult } from '../interfaces/action-result.interface';
import { HardDeleteCascadePolicy } from '../interfaces/hard-delete-cascade-policy.interface';

/**
 * Strategy interface สำหรับการกระทำเอกสารแต่ละประเภท
 * แต่ละ document type (Correspondence, RFA, Transmittal, Drawing, Circulation)
 * implement interface นี้เพื่อกำหนดวิธี cancel/hard-delete/metadata-patch
 */
export interface DocumentActionStrategy {
  /** ชื่อ document type (ใช้ใน registry) */
  readonly documentType: string;

  /**
   * ยกเลิกเอกสาร (soft-cancel หรือ soft-delete สำหรับ Drawing)
   * @returns ActionResult พร้อม sideEffects
   */
  cancel(
    publicId: string,
    userId: string,
    queryRunner: QueryRunner
  ): Promise<ActionResult>;

  /**
   * ลบถาวร (hard-delete) — ใช้ cascade policy ที่กำหนด
   */
  hardDelete(
    publicId: string,
    userId: string,
    queryRunner: QueryRunner
  ): Promise<ActionResult>;

  /**
   * แก้ไข metadata (3-tier validation)
   */
  metadataPatch(
    publicId: string,
    patch: Record<string, string | number | boolean | null>,
    version: number,
    userId: string,
    queryRunner: QueryRunner
  ): Promise<ActionResult>;

  /**
   * Cascade policy สำหรับ hard-delete ของ document type นี้
   */
  getCascadePolicy(): HardDeleteCascadePolicy;

  /**
   * รายการ field ที่แก้ไขได้ (3-tier)
   */
  getPatchableFields(): {
    tier1: string[];
    tier2: string[];
    tier3: string[];
  };
}
