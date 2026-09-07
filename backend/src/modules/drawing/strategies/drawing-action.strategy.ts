// File: backend/src/modules/drawing/strategies/drawing-action.strategy.ts
// บันทึกการแก้ไข: Drawing DocumentActionStrategy (Feature 253 — T043)

import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DocumentActionStrategy } from '../../../common/services/document-action-strategy.interface';
import { ActionResult } from '../../../common/interfaces/action-result.interface';
import { HardDeleteCascadePolicy } from '../../../common/interfaces/hard-delete-cascade-policy.interface';
import { DocumentSideEffectsService } from '../../../common/services/document-side-effects.service';

/**
 * Strategy สำหรับ Drawing document actions
 * Drawing ใช้ soft-delete (deletedAt + deleteReason) — ไม่ใช่ status-based cancel
 * รองรับ ContractDrawing, ShopDrawing, AsBuiltDrawing (ใช้ type แยก)
 */
@Injectable()
export class DrawingActionStrategy implements DocumentActionStrategy {
  readonly documentType = 'DRAWING';

  constructor(private readonly sideEffects: DocumentSideEffectsService) {}

  /**
   * Soft-delete Drawing — set deletedAt + deleteReason
   * Drawing ไม่มี status field — cancel = soft-delete
   */
  async cancel(
    publicId: string,
    userId: string,
    queryRunner: QueryRunner
  ): Promise<ActionResult> {
    // TODO: T044 — implement soft-delete via DrawingService
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
   * ลบถาวร Drawing — TODO: Phase 3 hard-delete
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
      tier1: ['title', 'description'],
      tier2: ['mainCategoryId', 'subCategoryId'],
      tier3: ['drawingNumber'],
    };
  }
}
