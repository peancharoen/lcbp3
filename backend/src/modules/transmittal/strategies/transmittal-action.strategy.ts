// File: backend/src/modules/transmittal/strategies/transmittal-action.strategy.ts
// บันทึกการแก้ไข: Transmittal DocumentActionStrategy (Feature 253 — T041)

import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DocumentActionStrategy } from '../../../common/services/document-action-strategy.interface';
import { ActionResult } from '../../../common/interfaces/action-result.interface';
import { HardDeleteCascadePolicy } from '../../../common/interfaces/hard-delete-cascade-policy.interface';
import { DocumentSideEffectsService } from '../../../common/services/document-side-effects.service';
import { TransmittalService } from '../transmittal.service';

/**
 * Strategy สำหรับ Transmittal document actions
 * Transmittal ใช้ correspondence_status FK (statusId) — ไม่ใช่ enum เหมือน Correspondence
 */
@Injectable()
export class TransmittalActionStrategy implements DocumentActionStrategy {
  readonly documentType = 'TRANSMITTAL';

  constructor(
    private readonly transmittalService: TransmittalService,
    private readonly sideEffects: DocumentSideEffectsService
  ) {}

  /**
   * ยกเลิก Transmittal — status → CANCELLED, terminate workflow
   * ไม่ cascade ไปยัง transmittal_items (items ยังคงอยู่)
   */
  async cancel(
    publicId: string,
    userId: string,
    queryRunner: QueryRunner
  ): Promise<ActionResult> {
    // TODO: T042 — implement cancel via TransmittalService
    const outcome = await this.sideEffects.executeCritical({
      publicId,
      documentType: this.documentType,
      userId,
      queryRunner,
    });

    return {
      success: true,
      publicId,
      action: 'CANCEL',
      sideEffects: {
        searchReindexed: outcome.searchReindexed,
        notificationsSent: outcome.notificationsSent,
        workflowTerminated: outcome.workflowTerminated,
        circulationsClosed: outcome.circulationsClosed,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: [],
      auditId: '',
    };
  }

  /**
   * ลบถาวร Transmittal — TODO: Phase 3 hard-delete
   */
  hardDelete(
    publicId: string,
    _userId: string,
    _queryRunner: QueryRunner
  ): Promise<ActionResult> {
    return Promise.resolve({
      success: false,
      publicId,
      action: 'HARD_DELETE',
      sideEffects: {
        searchReindexed: false,
        notificationsSent: 0,
        workflowTerminated: false,
        circulationsClosed: 0,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: ['hard-delete not yet implemented'],
      auditId: '',
    });
  }

  /**
   * แก้ไข metadata — TODO: Phase 4 metadata patch
   */
  metadataPatch(
    publicId: string,
    _patch: Record<string, string | number | boolean | null>,
    _version: number,
    _userId: string,
    _queryRunner: QueryRunner
  ): Promise<ActionResult> {
    return Promise.resolve({
      success: false,
      publicId,
      action: 'METADATA_PATCH',
      sideEffects: {
        searchReindexed: false,
        notificationsSent: 0,
        workflowTerminated: false,
        circulationsClosed: 0,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: ['metadata-patch not yet implemented'],
      auditId: '',
    });
  }

  getCascadePolicy(): HardDeleteCascadePolicy {
    return {
      deleteRelated: async () => {
        await Promise.resolve();
        return { filesToDelete: [] };
      },
      getStorageFiles: async () => {
        await Promise.resolve();
        return [];
      },
      deleteVectors: async () => {
        await Promise.resolve();
      },
    };
  }

  getPatchableFields() {
    return {
      tier1: ['subject', 'remarks'],
      tier2: ['purpose'],
      tier3: [],
    };
  }
}
